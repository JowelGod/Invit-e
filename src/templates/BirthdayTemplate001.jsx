// ✅ src/templates/BirthdayTemplate001.jsx
import React, { useState } from "react";

export default function BirthdayTemplate001({ eventData = {}, guests = [], onConfirm, isPreview = false }) {
  const { title = "", date = "", location = {} } = eventData;
  const { ceremony = {}, reception = {} } = location;

  const formattedDate = new Date(date).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const time = new Date(date).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const [confirmMode, setConfirmMode] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-purple-900 text-white font-sans">
      {/* Música */}
      {!isPreview && (
        <audio autoPlay loop className="hidden">
          <source src="/music/happyBirthdayToYouPiano.mp3" type="audio/mpeg" />
        </audio>
      )}

      <div className="max-w-4xl mx-auto py-10 px-6 space-y-10 animate-fade-in">
        {/* Título */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold uppercase drop-shadow-md tracking-wide text-pink-300">
            {title}
          </h1>
          <p className="mt-4 text-lg italic text-white">
            Estimado(s) {guests.join(", ")}, quedan cordialmente invitados al evento.<br/>
            ¡Esperamos contar con tu visita y hacer de este día algo inolvidable!
          </p>
        </div>

        {/* Información de ceremonia */}
        <div className="bg-black/40 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold text-yellow-300 mb-4 text-center uppercase">Ceremonia</h2>
          <p className="text-center text-lg font-semibold">{formattedDate} — {time}</p>
          <p className="text-center mt-2">{ceremony.street} {ceremony.number}, {ceremony.neighborhood}</p>
          <p className="text-center">{ceremony.city}, {ceremony.state} — CP {ceremony.postalCode}</p>
          <iframe
            className="w-full h-48 rounded-md mt-4"
            loading="lazy"
            src={`https://maps.google.com/maps?q=${ceremony.street}+${ceremony.number}+${ceremony.city}&output=embed`}
          ></iframe>
        </div>

        {/* Información de recepción */}
        {reception?.street && (
          <div className="bg-black/40 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-bold text-blue-300 mb-4 text-center uppercase">Recepción</h2>
            <p className="text-center">{reception.street} {reception.number}, {reception.neighborhood}</p>
            <p className="text-center">{reception.city}, {reception.state} — CP {reception.postalCode}</p>
            <iframe
              className="w-full h-48 rounded-md mt-4"
              loading="lazy"
              src={`https://maps.google.com/maps?q=${reception.street}+${reception.number}+${reception.city}&output=embed`}
            ></iframe>
          </div>
        )}

        {/* Invitados */}
        <div className="text-center">
          <p className="font-semibold text-pink-300 text-lg mb-2">Invitados especiales:</p>
          <ul className="flex flex-wrap justify-center gap-2 text-purple-200">
            {guests.map((g, i) => (
              <li key={i} className="bg-white/10 px-3 py-1 rounded-full">🎉 {g}</li>
            ))}
          </ul>
        </div>

        {/* Confirmación */}
        <div className="text-center mt-6">
          <p className="text-yellow-300 text-sm italic mb-2">Puedes confirmar por separado si alguien no asistirá</p>

          {!confirmMode ? (
            <>
              <button
                onClick={() => onConfirm('all')}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2 rounded mx-2 transition"
              >
                Confirmar todos
              </button>
              <button
                onClick={() => onConfirm('none')}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded mx-2 transition"
              >
                Rechazar todos
              </button>
              <div className="mt-4">
                <button
                  onClick={() => setConfirmMode(true)}
                  className="text-sm text-blue-300 underline hover:text-blue-200"
                >
                  Confirmar invitados por separado
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-4">
                <p className="text-white font-semibold mb-2">Selecciona asistentes confirmados:</p>
                {guests.map((g, i) => (
                  <div key={i} className="flex items-center justify-center gap-2 mb-1">
                    <input type="checkbox" id={`g${i}`} className="accent-green-500" />
                    <label htmlFor={`g${i}`} className="text-white">{g}</label>
                  </div>
                ))}
                <button
                  onClick={() => alert("Confirmación personalizada enviada")}
                  className="mt-4 bg-green-600 hover:bg-green-700 px-6 py-2 rounded text-white"
                >
                  Confirmar seleccionados
                </button>
              </div>
              <div className="mt-2">
                <button
                  onClick={() => setConfirmMode(false)}
                  className="text-sm text-blue-300 underline hover:text-blue-200"
                >
                  Volver
                </button>
              </div>
            </> 
          )}
        </div>
      </div>
    </div>
  );
}
