import { useNavigate } from "react-router-dom";
import SignUpForm from "../components/SignUpForm";

export default function SignUp() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-blue-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <h2 className="text-3xl font-bold text-center text-gray-800">Regístrate</h2>

        <SignUpForm onSuccess={() => navigate("/dashboard")} />

        <p className="text-sm text-center text-gray-600">
          ¿Ya tienes cuenta?{" "}
          <button
            className="text-blue-600 hover:underline font-medium"
            onClick={() => navigate("/login")}
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
}
