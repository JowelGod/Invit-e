import { useEffect, useState } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { fetchUserEvents } from "../services/eventsService";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        navigate("/login");
      } else {
        setUser(currentUser);

        try {
          const userEvents = await fetchUserEvents();
          setEvents(userEvents);
        } catch (err) {
          console.error("Error al cargar eventos:", err);
        }
      }
    });

    return () => unsub();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-4">
        <button
          onClick={() => navigate(`/`)}
          className="text-blue-600 hover:underline flex items-center"
        >
          ← Volver al Inicio
        </button>
      </div>
      <h1 className="text-3xl font-bold mb-2">👋 ¡Hola, {user?.email}!</h1>
      <p className="text-gray-600 mb-6">
        Plan actual:{" "}
        <span className="font-semibold text-blue-600">Pro</span>
      </p>

      {/* Botón de crear nuevo evento */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/create-event")}
          className="bg-green-500 text-white px-5 py-2 rounded hover:bg-green-600 transition"
        >
          ➕ Crear nuevo evento
        </button>
      </div>

      {/* Lista de eventos */}
      <h2 className="text-xl font-semibold mb-2">Tus eventos</h2>
      {events.length === 0 ? (
        <p className="text-gray-500">No tienes eventos creados todavía.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event, index) => (
          <div
            key={index}
            onClick={() => navigate(`/evento/${event.id}`)} // 👉 cambia esto
            className="p-4 bg-white shadow rounded flex justify-between items-center cursor-pointer hover:bg-gray-100 transition"
          >
            <div>
              <h3 className="font-semibold">{event.title}</h3>
              <p className="text-sm text-gray-600">{event.date}</p>
            </div>
            <span
              className={`text-sm font-medium ${
                event.status === "Próximo" ? "text-green-600" : "text-gray-500"
              }`}
            >
              {event.status}
            </span>
          </div>
        ))}
        </div>
      )}

      {/* Link para cambiar de plan */}
      <div className="mt-8 text-sm text-center text-gray-500">
        ¿Quieres más funciones?{" "}
        <button
          className="text-blue-600 hover:underline font-medium"
          onClick={() => alert("🚧 Aquí irá la página de planes")}
        >
          Cambiar de plan
        </button>
      </div>
    </div>
  );
}
