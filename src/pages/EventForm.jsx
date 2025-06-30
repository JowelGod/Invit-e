import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { createEvent, getEventById, updateEvent } from "../services/eventsService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { TEMPLATE_COMPONENTS } from "../templates/TemplateRegistry";

export default function EventForm() {
  const { templateId, eventId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(eventId);

  const [template, setTemplate] = useState(null);
  const [showCeremony, setShowCeremony] = useState(false);
  const [showReception, setShowReception] = useState(false);

  const [form, setForm] = useState({
    title: "",
    date: "",
    type: "",
    guestLimit: "",
    templateId: templateId || "",
    description: "",
    hosts: [{
      name: "",
      contactInfo: { email: "", phone: "" }
    }],
    location: {
      ceremony: { street: "", number: "", neighborhood: "", city: "", state: "", postalCode: "" },
      reception: { street: "", number: "", neighborhood: "", city: "", state: "", postalCode: "" }
    }
  });

  // Cargar datos del evento si estás editando
useEffect(() => {
  if (!isEditing) return;
  const fetchEvent = async () => {
    try {
      const data = await getEventById(eventId);
      if (data) {
        setForm({
          ...data,
          date: data.date?.slice(0, 16) || "",
        });
      }
    } catch (err) {
      console.error("Error al cargar evento:", err);
    }
  };
  fetchEvent();
}, [eventId, isEditing]);


  // Cargar plantilla
useEffect(() => {
  const fetchTemplate = async () => {
    const currentTemplateId = isEditing ? form.templateId : templateId;
    if (!currentTemplateId) return;
    const ref = doc(db, "templates", currentTemplateId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setTemplate(snap.data());
    }
  };
  fetchTemplate();
}, [form.templateId, templateId, isEditing]);


  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith("location.")) {
      const [, section, field] = name.split(".");
      setForm((prev) => ({
        ...prev,
        location: {
          ...prev.location,
          [section]: {
            ...prev.location[section],
            [field]: value
          }
        }
      }));
    } else if (name.startsWith("hosts.")) {
      const [, index, field] = name.split(".");
      const updatedHosts = [...form.hosts];
      if (field === "phone" || field === "email") {
        updatedHosts[index].contactInfo[field] = value;
      } else {
        updatedHosts[index][field] = value;
      }
      setForm((prev) => ({ ...prev, hosts: updatedHosts }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.templateId) {
      alert("⚠️ Debes seleccionar una plantilla antes de guardar.");
      return;
    }

    try {
      if (isEditing) {
        await updateEvent(eventId, form);
        alert("✅ Evento actualizado");
      } else {
        await createEvent(form);
        alert("🎉 Evento creado correctamente");
      }
      navigate("/dashboard");
    } catch (err) {
      alert("❌ Error al guardar el evento.");
      console.error(err);
    }
  };

  const Component = template ? TEMPLATE_COMPONENTS[template.component] : null;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <div className="mb-4">
        <button
          onClick={() => navigate(isEditing ? `/evento/${eventId}` : `/create-event`)}
          className="text-blue-600 hover:underline flex items-center"
        >
          ← Volver
        </button>
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="w-full lg:w-1/2 p-6 space-y-4 bg-white overflow-y-auto"
      >
        <h1 className="text-2xl font-bold text-primary mb-4">Información del Evento</h1>

        <input name="title" placeholder="Título" value={form.title || ""} onChange={handleChange} required className="w-full border p-2 rounded" />
        <input type="datetime-local" name="date" value={form.date || ""} onChange={handleChange} required className="w-full border p-2 rounded"/>
        <input name="type" placeholder="Tipo de evento" value={form.type || ""} onChange={handleChange} required className="w-full border p-2 rounded" />
        <input type="number" name="guestLimit" placeholder="Invitados máximos" value={form.guestLimit || ""} onChange={handleChange} className="w-full border p-2 rounded" />
        <textarea name="description" placeholder="Descripción" value={form.description || ""} onChange={handleChange} className="w-full border p-2 rounded" />

        <h2 className="font-semibold">Hosts</h2>
        {form.hosts.map((host, i) => (
          <div key={i} className="space-y-2">
            <input name={`hosts.${i}.name`} value={host.name || ""} onChange={handleChange} placeholder="Nombre del Anfitrión" className="w-full border p-2 rounded" />
            <input name={`hosts.${i}.contactInfo.phone`} value={host.contactInfo.phone || ""} onChange={handleChange} placeholder="Teléfono" className="w-full border p-2 rounded" />
            <input name={`hosts.${i}.contactInfo.email`} value={host.contactInfo.email || ""} onChange={handleChange} placeholder="Correo electrónico" className="w-full border p-2 rounded" />
          </div>
        ))}

        <label className="block mt-4">
          <input type="checkbox" checked={showCeremony} onChange={() => setShowCeremony(!showCeremony)} className="mr-2" /> Dirección de ceremonia
        </label>
        {showCeremony &&
          ["street", "number", "neighborhood", "city", "state", "postalCode"].map((field) => (
            <input
              key={field}
              name={`location.ceremony.${field}`}
              value={form.location.ceremony[field] || ""}
              onChange={handleChange}
              placeholder={`Ceremonia - ${field}`}
              className="w-full border p-2 rounded"
            />
          ))}

        <label className="block mt-4">
          <input type="checkbox" checked={showReception} onChange={() => setShowReception(!showReception)} className="mr-2" /> Dirección de recepción
        </label>
        {showReception &&
          ["street", "number", "neighborhood", "city", "state", "postalCode"].map((field) => (
            <input
              key={field}
              name={`location.reception.${field}`}
              value={form.location.reception[field] || ""}
              onChange={handleChange}
              placeholder={`Recepción - ${field}`}
              className="w-full border p-2 rounded"
            />
          ))}

        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition">
          Guardar evento
        </button>
      </form>

      {/* Vista previa */}
      <div className="w-full lg:w-1/2 bg-gray-100 p-4 overflow-y-auto">
        <h2 className="text-center text-lg font-semibold mb-4 text-gray-700">Vista previa de la invitación</h2>
        {Component ? (
          <Component eventData={form} guests={["Áron", "Valeria"]} />
        ) : (
          <p className="text-center text-gray-500">Cargando plantilla...</p>
        )}
      </div>
    </div>
  );
}
