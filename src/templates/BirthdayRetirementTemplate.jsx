// src/templates/BirthdayRetirementTemplate.jsx
import { Description } from "@headlessui/react";
import React, { useState } from "react";
import { updateGuest } from "../services/guestsService";
import { getEventById, updateEvent } from "../services/eventsService";


export default function BirthdayRetirementTemplate({ eventData, guests = [], isPreview = false, onConfirm, responded = false, guestData, setResponded}) {
  const { title, date, location, hosts = [],description } = eventData;
  const { ceremony } = location || {};

  const formattedDate = new Date(date).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const time = new Date(date).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const weekday = new Date(date).toLocaleDateString("es-MX", { 
    weekday: "long" }).replace(/^\w/, c => c.toUpperCase());

  const [confirmMode, setConfirmMode] = useState(false);

  const allGuestsStructured = guestData?.guests?.map((guest, index) => {
    const firstName = guest?.firstName || "";
    const lastName = guest?.lastName || "";
    const name = `${firstName} ${lastName}`.trim();

    const extraCount = guest?.extraGuests || 0;
    const extras = Array.from({ length: extraCount }, (_, i) => ({
      label: `Invitado extra ${i + 1}`,
      parentIndex: index,
    }));

    return {
      name,
      index,
      extras,
    };
  }) || [];

  // Estado para checkboxes individuales
  const [selectedGuests, setSelectedGuests] = useState([]);

  // Manejar cambio en checkbox
  const toggleGuest = (key) => {
    setSelectedGuests((prev) =>
      prev.includes(key)
        ? prev.filter((g) => g !== key)
        : [...prev, key]
    );
  };


  return (
    <div className="relative w-full bg-[#313248] text-white p-6 rounded-md shadow-lg max-w-2xl mx-auto bg-cover bg-center z-[1]" >
      {/* Fondo con opacidad */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10 z-[-1]"
        style={{ backgroundImage: "url('/images/confeti1.png')" }}
      ></div>
      {/* Elementos decorativos */}
      <img src="/images/copas.png" className="absolute top-4 left-4 w-10 opacity-70" alt="Copas" />
      <img src="/images/copas.png" className="absolute top-4 right-4 w-10 opacity-70" alt="Confeti" />

      {/* Cabecera */}
      <div className="text-center space-y-2">
        <h1 className="text-teal-400 text-5xl uppercase font-bold font-marker">{title}</h1>
        <h2 className="text-4xl text-white font-marker ">{description}</h2>
        <div className="h-[2px] w-50 bg-white mx-auto my-2"></div>
      </div>

      {/* Info del evento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm sm:text-base">
        <div className="text-center">
          <p className="uppercase text-gray-400">Fecha</p>
          <p>{formattedDate}</p>
          <p>{time}</p>
        </div>
        <div className="text-center">
          <p className="uppercase text-gray-400">Salón</p>
          <p className="font-bold">{ceremony?.street} {ceremony?.number}</p>
          <p>{ceremony?.neighborhood}, {ceremony?.city}, {ceremony?.state}</p>
        </div>
      </div>

      {/* Confirmación */}
      <div className="mt-5 text-center text-green-400 from-neutral-200">
        <p className="text-2xl italic font-marker">Si jalas confirma... y si zafas también</p>
        <p className="text-sm font-sans text-green-300">Envia tu respuesta lo antes posible (Muy importante para la logística)</p>
      </div>

      {responded ? (
        <p className="text-center text-green-300 font-bold mt-6">
          ✅ Ya has confirmado tu asistencia. ¡Gracias!
        </p>
      ) : (
        <>
          {!confirmMode ? (
            <>
              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    className="bg-green-600 hover:bg-green-700 text-sm px-4 py-1 rounded text-white transition"
                    onClick={async () => {
                      try {
                        const totalGuests = [];
                        guests.forEach(g => {
                          const name = `${g.firstName} ${g.lastName}`;
                          totalGuests.push(name);
                          const extras = g.extraGuests || 0;
                          for (let i = 0; i < extras; i++) {
                            totalGuests.push(`Invitado extra ${i + 1} (${name})`);
                          }
                        });

                        await updateGuest(guestData.id, {
                          confirmedCount: totalGuests.length,
                          rejectedCount: 0,
                          pendingCount: 0,
                          responded: true,
                          status: "confirmed",
                          confirmedGuests: totalGuests,
                          rejectedGuests: [],
                        });
                        alert("✅ Todos confirmados correctamente.");
                        setResponded(true);
                      } catch (error) {
                        console.error("Error al guardar confirmación:", error);
                        alert("❌ Error al guardar confirmación");
                      }
                    }}
                  >
                    Confirmar
                  </button>

                  <button
                    className="bg-red-600 hover:bg-red-700 text-sm px-4 py-1 rounded text-white"
                    onClick={async () => {
                      try {
                        await updateGuest(guestData.id, {
                          confirmedCount: 0,
                          rejectedCount: guestData.ticketCount,
                          pendingCount: 0,
                          responded: true,
                          confirmedGuests: [],
                          rejectedGuests: guests.map(g => {
                            const fullName = `${g.firstName} ${g.lastName}`;
                            const extras = g.extraGuests || 0;
                            const extraLabels = Array.from({ length: extras }, (_, i) => `Invitado extra ${i + 1} (${fullName})`);
                            return [fullName, ...extraLabels];
                          }).flat(),
                          status: "rejected",
                        });

                        alert("❌ Rechazo registrado correctamente.");
                        setResponded(true);
                      } catch (error) {
                        console.error("Error al guardar rechazo:", error);
                        alert("❌ Error al guardar rechazo");
                      }
                    }}
                  >
                    Rechazar
                  </button>
                </div>
                <div className="mt-2 text-center">
                  <button
                    onClick={() => setConfirmMode(true)}
                    className="text-sm text-blue-300 underline hover:text-blue-200"
                  >
                    Confirmar invitados por separado
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 text-center">
                <p className="text-white font-semibold mb-2">Selecciona asistentes confirmados:</p>

                {guests.map((guest, i) => {
                  const name = `${guest.firstName} ${guest.lastName}`;
                  const extras = guest.extraGuests || 0;

                  return (
                    <div key={`group-${i}`} className="ml-2 mb-1">
                      {/* Invitado principal */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`g-${i}-0`}
                          checked={selectedGuests.includes(`${i}-0`)}
                          onChange={() => toggleGuest(`${i}-0`)}
                          className="accent-green-500"
                        />
                        <label htmlFor={`g-${i}-0`} className="text-white">
                          @ {name}
                        </label>
                      </div>

                      {/* Invitados extra */}
                      {[...Array(extras)].map((_, j) => (
                        <div key={`extra-${i}-${j}`} className="flex items-center gap-2 ml-6">
                          <input
                            type="checkbox"
                            id={`g-${i}-${j + 1}`}
                            checked={selectedGuests.includes(`${i}-${j + 1}`)}
                            onChange={() => toggleGuest(`${i}-${j + 1}`)}
                            className="accent-purple-500"
                          />
                          <label htmlFor={`g-${i}-${j + 1}`} className="text-purple-300">
                            └➤ 👤 Invitado extra {j + 1}
                          </label>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* BOTÓN ACTUALIZADO */}
                <button
                  onClick={async () => {
                    let confirmedGuests = [];
                    let rejectedGuests = [];
                    let confirmedCount = 0;
                    let rejectedCount = 0;

                    guests.forEach((guest, i) => {
                      const name = `${guest.firstName} ${guest.lastName}`;
                      const extras = guest.extraGuests || 0;

                      // Principal
                      if (selectedGuests.includes(`${i}-0`)) {
                        confirmedGuests.push(name);
                        confirmedCount++;
                      } else {
                        rejectedGuests.push(name);
                        rejectedCount++;
                      }

                      // Extras
                      for (let j = 0; j < extras; j++) {
                        const label = `Invitado extra ${j + 1} (${name})`;
                        const key = `${i}-${j + 1}`;

                        if (selectedGuests.includes(key)) {
                          confirmedGuests.push(label);
                          confirmedCount++;
                        } else {
                          rejectedGuests.push(label);
                          rejectedCount++;
                        }
                      }
                    });

                    try {
                      await updateGuest(guestData.id, {
                        confirmedCount,
                        rejectedCount,
                        pendingCount: 0,
                        responded: true,
                        confirmedGuests,
                        rejectedGuests,
                        status: confirmedCount > 0 ? "partial" : "rejected",
                      });

                      alert("✅ Confirmación registrada correctamente.");
                      setResponded(true);
                    } catch (error) {
                      console.error("Error al guardar confirmación:", error);
                      alert("❌ Error al guardar confirmación");
                    }
                  }}
                  className="mt-4 bg-green-600 hover:bg-green-700 px-6 py-2 rounded text-white"
                >
                  Confirmar seleccionados
                </button>

                <div className="mt-2">
                  <button
                    onClick={() => setConfirmMode(false)}
                    className="text-sm text-blue-300 underline hover:text-blue-200"
                  >
                    Volver
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Regalos y boleto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm">
        <div>
          <p className="text-pink-400 font-bold">Mesa de regalos:</p>
          <ul className="list-disc list-inside">
            <li>PH / Liverpool / La Europea</li>
            <li>San Pablo / Home Depot</li>
            <li>Efectivo / Abrazos</li>
          </ul>
        </div>
        <div>
          <p className="text-white font-bold">🎟️ Boleto personal y exclusivo para:</p>
          {allGuestsStructured.map((guestGroup, i) => (
            <div key={`ticket-${i}`} className="ml-2 mb-1">
              {/* Invitado principal */}
                <label htmlFor={`ticket-g-${i}`} className="text-white">
                  🧍 {guestGroup.name}
                </label>
              {/* Invitados extra anidados */}
              {guestGroup.extras.map((extra, j) => (
                <div key={`ticket-extra-${i}-${j}`} className="flex items-center gap-2 ml-6">
                  <label htmlFor={`ticket-extra-${i}-${j}`} className="text-purple-300">
                    └➤ 👤 {extra.label}
                  </label>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Mapa */}
      <div className="relative z-10 mt-6">
        <iframe
          className="w-full h-64 rounded"
          loading="lazy"
          src={`https://www.google.com/maps?q=${encodeURIComponent(`${ceremony?.street} ${ceremony?.number}, ${ceremony?.neighborhood}, ${ceremony?.city}`)}&output=embed`}
        ></iframe>
      </div>

      {/* Extras */}
      <div className="mt-6 text-center text-white">
        <p className="text-lg font-bold">¡NO FALTES!</p>
        <p className="text-cyan-400 italic">Tú eres parte especial en este festejo</p>
      </div>

      {/* Contacto y código de vestimenta */}
      <div className="bg-yellow-100 p-4 text-black rounded-md mt-6 flex flex-col sm:flex-row sm:justify-between sm:items-start">
        <div className="sm:w-1/2">
          <h3>Informes y Quejas:</h3>
          {hosts.map((host, i) => (
            <small key={i}> {host.name} <br />📞 {host.contactInfo?.phone} <br /> 📧 {host.contactInfo.email}<br /></small>
          ))}
        </div>
        <div className="relative z-10 text-sm text-left mt-6 text-orange-500 font-bold uppercase truncate">
          Vestimenta: Casual / Informal<br />
          👉🏽No pants<br /> 👉🏽no pijama<br /> 👉🏽no jeans rotos
        </div>
      </div>
    </div>
  );
}
