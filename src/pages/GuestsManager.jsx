// src/pages/GuestsManager.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  addGuestToEvent,
  updateGuest,
  deleteGuest,
  fetchGuestsByEvent
} from "../services/guestsService";
import { getEventById } from "../services/eventsService";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

export default function GuestsManager() {
  const { id: eventId } = useParams();
  const navigate = useNavigate();

  const [groupName, setGroupName] = useState("");
  const [ticketCount, setTicketCount] = useState(1);
  const [guests, setGuests] = useState([{ firstName: "", lastName: "", extraGuests: 0 }]);
  const [eventInfo, setEventInfo] = useState(null);
  const [existingGuests, setExistingGuests] = useState([]);
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contactInfo, setContactInfo] = useState({ email: "", phone: "" });
  const [rejectedCount, setRejectedCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);


  // 🔹 Cargar evento y lista de invitados
  useEffect(() => {
    const loadEvent = async () => {
      const event = await getEventById(eventId);
      setEventInfo(event);
    };

    loadEvent();

    // Suscripción en tiempo real
    const q = query(collection(db, "guests"), where("eventId", "==", eventId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const guestsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExistingGuests(guestsList);
    });

    return () => unsubscribe(); // Cancelar suscripción al desmontar
  }, [eventId]);

  const getRejectedTickets = () =>
    existingGuests.reduce((total, group) => total + (group.rejectedCount || 0), 0);

  const calculateRemainingTickets = () => {
    const used = existingGuests.reduce((total, g) => total + g.ticketCount, 0);
    const currentEdit = selectedGuestId
      ? existingGuests.find((g) => g.id === selectedGuestId)?.ticketCount || 0
      : 0;
    return (eventInfo?.guestLimit || 0) - used + currentEdit - calculateTotalTickets() + getRejectedTickets(); ;
  };

  // 🔹 Validar capacidad de boletos
  const getUsedTickets = () =>
    existingGuests.reduce((total, g) => total + g.ticketCount, 0);

  const remainingTickets =
    eventInfo?.guestLimit - getUsedTickets() + getRejectedTickets();
    (selectedGuestId
      ? existingGuests.find(g => g.id === selectedGuestId)?.ticketCount || 0: 0);
      
  const handleGuestChange = (index, field, value) => {
    const updatedGuests = [...guests];
    updatedGuests[index][field] = value;
    setGuests(updatedGuests);
  };

  const handleExtraGuestsChange = (index, delta) => {
  const updatedGuests = [...guests];
  const current = updatedGuests[index].extraGuests || 0;
  updatedGuests[index].extraGuests = Math.max(0, current + delta);
  setGuests(updatedGuests);
};

const calculateTotalTickets = () => {
  return guests.reduce((total, guest) => total + 1 + (guest.extraGuests || 0), 0);
};

  const resetForm = () => {
    setGroupName("");
    setTicketCount(1);
    setGuests([{ firstName: "", lastName: "" }]);
    setContactInfo({ email: "", phone: "" });
    setSelectedGuestId(null);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (calculateTotalTickets() > remainingTickets) {
      alert("❌ No puedes asignar más boletos de los disponibles.");
      setLoading(false); 
      return;
    }

    try {
      const guestData = {
        groupName,
        ticketCount: calculateTotalTickets(),
        guests,
        contactInfo: {
          email: contactInfo.email || "",
          phone: contactInfo.phone || ""}
      };

      if (selectedGuestId) {
        await updateGuest(selectedGuestId, guestData);
      } else {
        await addGuestToEvent(eventId, guestData);
      }

      const updatedList = await fetchGuestsByEvent(eventId);
      setExistingGuests(updatedList);
      resetForm();
    } catch (error) {
      console.error(error);
      setError("❌ Error al guardar el invitado");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (guest) => {
    setGroupName(guest.groupName);
    setTicketCount(guest.ticketCount);
    setGuests(guest.guests);
    setSelectedGuestId(guest.id);
    setError("");
  };

  const handleDelete = async (id) => {
    if (confirm("¿Seguro que quieres eliminar este grupo de invitados?")) {
      await deleteGuest(id);
      const updatedList = await fetchGuestsByEvent(eventId);
      setExistingGuests(updatedList);
      resetForm();
    }
  };

  const handleRemoveGuest = (indexToRemove) => {
    const updatedGuests = guests.filter((_, index) => index !== indexToRemove);
    setGuests(updatedGuests);
  };

  const calculatePendingCount = (group) => {
    const total = group.ticketCount || 0;
    const confirmed = group.confirmedCount || 0;
    const rejected = group.rejectedCount || 0;
    return total - confirmed - rejected;
  };



  return (
    <div className="flex flex-col md:flex-row gap-8 p-6 max-w-8xl mx-auto ">
      <div className="mb-4">
        <button
          onClick={() => navigate(`/evento/${eventId}`)}
          className="text-blue-600 hover:underline flex items-center"
        >
          ← Volver a tu evento
        </button>
      </div>
      {/* FORMULARIO */}
      <div className="flex-1 bg-white shadow rounded p-6 border">
        <h2 className="text-xl font-semibold mb-4">
          {selectedGuestId ? "✏️ Editar grupo" : "➕ Nuevo grupo de invitados"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-600">{error}</p>}

          <div>
            <label className="block font-medium">Nombre del grupo:</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={groupName}
              placeholder="Ej. Familia González, Amigos del trabajo, Mauricio Ortega..."
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </div>

          <div className="mt-4">
            <label className="block font-medium">📧 Correo:</label>
            <input
              type="email"
              value={contactInfo.email}
              onChange={(e) => 
                setContactInfo((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="correo@ejemplo.com"
              className="w-full border rounded px-3 py-2"
              pattern="^[^@\s]+@[^@\s]+\.[^@\s]+$"
            />
          </div>

          <div className="mt-4">
            <label className="block font-medium">📱 Celular:</label>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={contactInfo.phone}
              onChange={(e) =>
                setContactInfo((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="5544332211"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="mt-4">
            <label className="block font-medium">🎟️ Boletos disponibles:</label>
            <div className="text-gray-800 font-semibold">{calculateRemainingTickets()}</div>
          </div>

          {guests.map((guest, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => handleRemoveGuest(index)}
                className="col-span-1 text-red-500 text-xl font-bold"
                title="Eliminar invitado"
              >×🗑️</button>
              <input
                type="text"
                placeholder="Nombre"
                value={guest.firstName}
                onChange={(e) => handleGuestChange(index, "firstName", e.target.value)}
                className="p-2 border rounded w-1/4"
                required
              />
              <input
                type="text"
                placeholder="Apellido(s)"
                value={guest.lastName}
                onChange={(e) => handleGuestChange(index, "lastName", e.target.value)}
                className="p-2 border rounded w-1/4"
                required
              />
              <div className="col.span-5">
                <label className="px-3 block text-xs font-medium text-gray-600 mb-0.1">👥Invitados extras</label>
                <div className="px-5 col-span-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExtraGuestsChange(index, -1)}
                    className="px-2 bg-gray-200 rounded"
                    disabled={guest.extraGuests <= 0}
                  >−</button>
                  <span className="min-w-[20px] text-center">{guest.extraGuests || 0}</span>
                  <button
                    type="button"
                    onClick={() => handleExtraGuestsChange(index, 1)}
                    disabled={calculateRemainingTickets() <= 0}
                    className="px-2 bg-gray-200 rounded"
                  >+</button>
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center mt-3">
            <button
              type="button"
              onClick={() => setGuests([...guests, { firstName: "", lastName: "" }])}
              disabled={calculateRemainingTickets() <= 0}
              className="text-blue-600 hover:underline"
            >
              + Agregar otro invitado
            </button>
            <p className="text-sm text-gray-500">🎫 Boletos usados: {calculateTotalTickets()}</p>
          </div>
          <div className="flex gap-4">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              disabled={loading}
            >
              {selectedGuestId ? "Actualizar" : "Guardar"}
            </button>
            {selectedGuestId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* LISTA */}
      <div className="flex-1">
        <h2 className="text-xl font-semibold mb-4">📋 Invitados registrados</h2>
        <div className="space-y-4">
          {existingGuests.map((group) => (
            <div key={group.id} className="border rounded p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">{group.groupName}</h3>
                <div className="text-sm text-gray-500">
                  {group.contactInfo.email && <span>📧 {group.contactInfo.email} </span>}
                  {group.contactInfo.phone && <span>📱 {group.contactInfo.phone}</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(group)}
                    className="text-blue-600 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    className="text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                🎟️ {group.ticketCount} boletos | ✅ {group.confirmedCount} | ❌ {group.rejectedCount} | ⏳ {calculatePendingCount(group)}
              </p>
              <ul className="text-sm mt-2 space-y-1 pl-2">
                {group.guests.map((g, i) => {
                  const fullName = `${g.firstName} ${g.lastName}`;
                  const isConfirmed = group.confirmedGuests?.includes(fullName);
                  const isRejected = group.rejectedGuests?.includes(fullName);

                  return (
                    <li key={i}>
                      <span
                        className={`font-medium ${isConfirmed ? 'text-green-600' : isRejected ? 'text-red-600' : 'text-gray-800'}`}
                      >
                        {fullName}
                      </span>

                      {/* Invitados extra */}
                      {Array.from({ length: g.extraGuests || 0 }).map((_, j) => {
                        const extraName = `Invitado extra ${j + 1}`;
                        const extraConfirmed = group.confirmedGuests?.includes(extraName);
                        const extraRejected = group.rejectedGuests?.includes(extraName);

                        return (
                          <div key={j} className="pl-4 flex items-center gap-1">
                            <span className="text-sm">↳</span>
                            <span
                              className={`text-sm ${extraConfirmed ? 'text-green-600' : extraRejected ? 'text-red-600' : 'text-gray-600'}`}
                            >
                              {extraName}
                            </span>
                          </div>
                        );
                      })}
                    </li>
                  );
                })}
              </ul>

              {/* 🔗 Link personalizado de invitación */}
              <div className="mt-2 flex items-center gap-2">
                <a
                  href={`${window.location.origin}/invitacion/${group.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline break-all"
                >
                  {`${window.location.origin}/invitacion/${group.id}`}
                </a>
                <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/invitacion/${group.id}`);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 border border-gray-300 rounded"
                  >
                    Copiar
                  </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
