import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? '';

const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const adminClient = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function response(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
      },
    }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: cors,
    });
  }

  if (req.method !== 'POST') {
    return response(
      { error: 'Method not allowed' },
      405
    );
  }

  try {
    const body = await req.json();

    const username = String(
      body.username ?? ''
    )
      .trim()
      .toLowerCase();

    const code = String(
      body.code ?? ''
    ).trim();

    if (!username || !code) {
      return response(
        {
          error:
            'Username e codice di accesso sono obbligatori.',
        },
        400
      );
    }

    if (code.length < 8) {
      return response(
        {
          error:
            'Username o codice di accesso non validi.',
        },
        401
      );
    }

    /*
     * Verifica server-side del codice.
     * La funzione PostgreSQL confronta il codice
     * con il relativo hash.
     */
    const {
      data: matches,
      error: verifyError,
    } = await adminClient.rpc(
      'verify_admin_access_code',
      {
        p_username: username,
        p_code: code,
      }
    );

    if (verifyError) {
      console.error(
        'Access code verification error:',
        verifyError
      );

      return response(
        {
          error:
            'Errore durante la verifica delle credenziali.',
        },
        500
      );
    }

    const profile = matches?.[0];

    if (
      !profile ||
      !profile.user_id ||
      !profile.email ||
      !profile.is_active
    ) {
      return response(
        {
          error:
            'Username o codice di accesso non validi.',
        },
        401
      );
    }

    /*
     * Genera un token Auth per l'utente reale.
     *
     * generateLink() genera il token ma non invia
     * autonomamente una mail: viene utilizzato qui
     * esclusivamente come ponte tecnico per creare
     * la sessione Supabase.
     */
    const {
      data: linkData,
      error: linkError,
    } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    });

    if (linkError) {
      console.error(
        'Generate auth link error:',
        linkError
      );

      return response(
        {
          error:
            'Impossibile completare l autenticazione.',
        },
        500
      );
    }

    const tokenHash =
      linkData?.properties?.hashed_token;

    if (!tokenHash) {
      console.error(
        'Missing hashed token in generateLink response'
      );

      return response(
        {
          error:
            'Token di autenticazione non disponibile.',
        },
        500
      );
    }

    return response({
      ok: true,
      token_hash: tokenHash,
    });
  } catch (error) {
    console.error(
      'auth-username error:',
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : 'Errore interno';

    return response(
      { error: message },
      500
    );
  }
});