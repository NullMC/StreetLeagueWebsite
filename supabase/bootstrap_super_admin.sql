-- One-time bootstrap for the existing Super Admin.
-- Replace the two placeholder values before running.
-- This does not store the access code in plaintext.

update public.profiles
set email = 'YOUR_REAL_SUPER_ADMIN_EMAIL@example.com'
where username = 'YOUR_SUPER_ADMIN_USERNAME';

select public.set_admin_access_code(
  id,
  'YOUR_PERMANENT_SUPER_ADMIN_CODE'
)
from public.profiles
where username = 'YOUR_SUPER_ADMIN_USERNAME'
  and role = 'super_admin';
