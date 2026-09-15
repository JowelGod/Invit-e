import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <main className="home">
      <div className="home__content">
        <p className="eyebrow">Invitaciones digitales y RSVP</p>
        <h1>Organiza lugares y respuestas sin perder el control.</h1>
        <p>
          Esta versión inicial de Invitame conecta el evento, los grupos invitados y sus
          confirmaciones en un recorrido sencillo.
        </p>
        <div className="button-row">
          <Link className="button" to="/registro">
            Crear cuenta
          </Link>
          <Link className="button button--secondary" to="/login">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
