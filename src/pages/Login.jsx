import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import SignUpForm from "../components/SignUpForm";

export default function Login() {
  const [view, setView] = useState("login");
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-xl p-6">
        {view === "login" ? (
          <>
            <h2 className="text-2xl font-bold mb-4 text-center">Inicia sesión</h2>
            <LoginForm onSuccess={handleSuccess} />
            <p className="mt-4 text-sm text-center">
              ¿No tienes cuenta?{" "}
              <button
                className="text-blue-500 underline"
                onClick={() => setView("signup")}
              >
                Regístrate
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4 text-center">Regístrate</h2>
            <SignUpForm onSuccess={handleSuccess} />
            <p className="mt-4 text-sm text-center">
              ¿Ya tienes cuenta?{" "}
              <button
                className="text-blue-500 underline"
                onClick={() => setView("login")}
              >
                Inicia sesión
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
