// ✅ src/pages/GuestInvitation.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { TEMPLATE_COMPONENTS } from "../templates/TemplateRegistry";
import { updateGuest } from "../services/guestsService";


export default function GuestInvitation() {
  const { guestId } = useParams();

  const [guestData, setGuestData] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responded, setResponded] = useState(false);


  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Obtener grupo de invitados
        const guestRef = doc(db, "guests", guestId);
        const guestSnap = await getDoc(guestRef);
        if (!guestSnap.exists()) throw new Error("Invitado no encontrado");

        const guestInfo = guestSnap.data();
        setGuestData({ id: guestSnap.id, ...guestInfo });

        if (guestInfo.responded) {
            setResponded(true);
        }

        // 2. Obtener evento
        const eventRef = doc(db, "events", guestInfo.eventId);
        const eventSnap = await getDoc(eventRef);
        if (!eventSnap.exists()) throw new Error("Evento no encontrado");

        const eventInfo = eventSnap.data();
        setEventData({ id: eventSnap.id, ...eventInfo });

        // 3. Obtener plantilla
        const templateRef = doc(db, "templates", eventInfo.templateId);
        const templateSnap = await getDoc(templateRef);
        if (templateSnap.exists()) {
          setTemplate(templateSnap.data());
        }
      } catch (err) {
        console.error("Error al cargar datos de la invitación:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [guestId]);

  if (loading) return <p className="text-center mt-10 text-gray-600">Cargando invitación...</p>;
  if (!guestData || !eventData || !template) return <p className="text-center text-red-500">Error al cargar la invitación</p>;

  const TemplateComponent = TEMPLATE_COMPONENTS[template.component];
  if (!TemplateComponent) return <p className="text-center text-red-600">Plantilla no encontrada</p>;

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <TemplateComponent
        eventData={eventData}
        guests={guestData.guests}
        guestData={guestData}
        isPreview={false}
        responded={responded}
        setResponded={setResponded}
        onConfirm={(response) => alert(`Confirmación: ${response}`)}
      />
    </div>
  );
}
