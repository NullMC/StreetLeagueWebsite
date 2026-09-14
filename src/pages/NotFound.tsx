import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    
    <div className="page error-page">
      <div className="error-page__inner">
        <div className="error-page__code"><h1>404</h1></div>
        <h1>Pagina non trovata</h1>
        <p>Il percorso richiesto non corrisponde a una pagina disponibile.</p>
        <div className="error-page__actions">
          <Link className="btn btn--primary" to="/">
            Torna alla home
          </Link>
          <Link className="btn btn--ghost" to="/partite">
            Vai alle partite
          </Link>
        </div>
      </div>
    </div>
    
  );
}
