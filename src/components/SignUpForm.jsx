import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { Transition } from "@headlessui/react";

export default function SignUpForm({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) return setError("Ingresa un correo válido.");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (!/[#\$%\^&\*\)\(!¡\?¿\/\-\+\(]/.test(password)) return setError("La contraseña debe contener al menos un carácter especial (#, $, %, ^, &, *, ...).");
    if (!/[A-Z]/.test(password)) return setError("La contraseña debe contener al menos una letra mayúscula.");

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      onSuccess();
    } catch (err) {
      setError("Error al registrarse: " + err.message);
    }
  };

  return (
    <form onSubmit={handleSignUp} className="space-y-5">
      <div>
        <label className="block mb-1 font-medium">Correo electrónico</label>
        <input
          type="email"
          className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block mb-1 font-medium">Contraseña</label>
        <input
          type="password"
          className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <Transition
        show={!!error}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <p className="text-red-600 text-sm">{error}</p>
      </Transition>

      <button
        type="submit"
        className="w-full bg-green-600 text-white font-semibold py-3 rounded hover:bg-green-700 transition-colors"
      >
        Registrarse
      </button>
    </form>
  );
}
