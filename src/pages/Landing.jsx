import { useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig";
import { useEffect, useState } from "react";

export default function Landing() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setUser);
    return () => unsub();
  }, []);

  const handleClick = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6">
      <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
        Crea tus eventos <span className="text-blue-600">con estilo</span>
      </h2>

      <p className="text-gray-600 text-lg mb-6 max-w-xl">
        Una plataforma inteligente y personalizada para gestionar tus invitaciones
        con facilidad, tecnología y diseño.
      </p>

      <button
        onClick={handleClick}
        className="px-6 py-3 bg-green-500 text-white rounded-full text-lg font-semibold hover:bg-green-600 transition-all"
      >
        Comenzar ahora
      </button> 
    </main>
  );
}
