import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig";
import { useEffect, useState } from "react";

export default function Header() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setUser);
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-white shadow-md px-6 py-4 flex items-center justify-between">
      <Link to="/" className="text-2xl font-bold text-primary">Eventide</Link>

      {user ? (
        <div className="relative">
            <div className="peer w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold cursor-pointer">
                {user.email[0].toUpperCase()}
            </div>
            <div className="absolute right-0 mt-2 w-40 bg-white border rounded-lg shadow-lg opacity-0 peer-hover:opacity-100 hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-auto">
                <Link to="/dashboard" className="block px-4 py-2 hover:bg-gray-100">Dashboard</Link>
                <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                Cerrar sesión
                </button>
            </div>
        </div>
      ) : (
        <div className="space-x-4">
          <Link
            to="/login"
            className="px-4 py-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-600 hover:text-white transition"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Registrarse
          </Link>
        </div>
      )}
    </header>
  );
}
