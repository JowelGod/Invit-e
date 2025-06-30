// src/pages/EventDetails.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getEventById, deleteEvent } from "../services/eventsService";
import { onSnapshot, collection, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";


export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); 
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
 

  useEffect(() => {
    const q = query(collection(db, "guests"), where("eventId", "==", id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const guestsData = snapshot.docs.map(doc => doc.data());

      const confirmed = guestsData.reduce((acc, g) => acc + (g.confirmedCount || 0), 0);
      const rejected = guestsData.reduce((acc, g) => acc + (g.rejectedCount || 0), 0);
      const pending = guestsData.reduce((acc, g) => acc + (g.pendingCount || 0), 0);

      setConfirmedCount(confirmed);
      setRejectedCount(rejected);
      setPendingCount(pending);
    });
    return () => unsubscribe(); // Limpiar el listener
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const evt = await getEventById(id);
        setEvent(evt);
      } catch (err) {
        setError("No se pudo cargar el evento");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleDelete = async () => {
    if (confirm("¿Estás seguro de eliminar este evento?")) {
      try {
        await deleteEvent(id);
        navigate("/dashboard");
      } catch (err) {
        alert("Error al eliminar el evento");
      }
    }
  };

  if (loading) return <p className="text-center mt-10">Cargando evento...</p>;
  if (error) return <p className="text-center mt-10 text-red-500">{error}</p>;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 text-gray-800">
      {/* Volver al dashboard */}
      <div className="mb-4">
        <button
          onClick={() => navigate(`/dashboard`)}
          className="text-blue-600 hover:underline flex items-center"
        >
          ← Volver al dashboard
        </button>
      </div>

      {/* Encabezado del evento */}
      <h1 className="text-4xl font-bold text-indigo-900 mb-1">{event.title}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Tipo: <span className="capitalize">{event.type}</span> | Fecha:{" "}
        {new Date(event.date).toLocaleDateString("es-MX", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      {/* Ubicación ceremonia */}
      {event.location?.ceremony?.street && (
        <div className="mb-6 bg-white rounded shadow p-4">
          <h2 className="text-lg font-semibold text-purple-700 mb-1">📍 Ceremonia</h2>
          <p className="text-sm text-gray-700">
            {event.location.ceremony.street} {event.location.ceremony.number}, {event.location.ceremony.neighborhood},<br />
            {event.location.ceremony.city}, {event.location.ceremony.state}, CP {event.location.ceremony.postalCode}
          </p>
        </div>
      )}

      {/* Ubicación recepción */}
      {event.location?.reception?.street && (
        <div className="mb-6 bg-white rounded shadow p-4">
          <h2 className="text-lg font-semibold text-pink-700 mb-1">🎉 Recepción</h2>
          <p className="text-sm text-gray-700">
            {event.location.reception.street} {event.location.reception.number}, {event.location.reception.neighborhood},<br />
            {event.location.reception.city}, {event.location.reception.state}, CP {event.location.reception.postalCode}
          </p>
        </div>
      )}

      {/* Visualización gráfica de conteos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="bg-green-100 border-l-4 border-green-500 p-4 rounded shadow">
          <p className="text-lg font-bold text-green-700">✅ Confirmados</p>
          <p className="text-2xl font-extrabold text-green-800">{confirmedCount}</p>
        </div>
        <div className="bg-red-100 border-l-4 border-red-500 p-4 rounded shadow">
          <p className="text-lg font-bold text-red-700">❌ Rechazados</p>
          <p className="text-2xl font-extrabold text-red-800">{rejectedCount}</p>
        </div>
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded shadow">
          <p className="text-lg font-bold text-yellow-700">⏳ Pendientes</p>
          <p className="text-2xl font-extrabold text-yellow-800">{pendingCount}</p>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-4 mt-10">
        <button
          onClick={() => navigate(`/evento/${event.id}/edit`)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
        >
          ✏️ Editar evento
        </button>
        <button
          onClick={handleDelete}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow"
        >
          🗑️ Eliminar evento
        </button>
        <button
          onClick={() => navigate(`/evento/${id}/invitados`)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
        >
          👥 Gestionar invitados
        </button>
      </div>
    </div>
  );
}
