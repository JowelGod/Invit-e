import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="centered-state">
      <div>
        <h1>Página no encontrada</h1>
        <Link to="/">Volver al inicio</Link>
      </div>
    </main>
  );
}
