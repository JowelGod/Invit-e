import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { TEMPLATE_COMPONENTS } from "../templates/TemplateRegistry";

export default function TemplatePreview() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);

  useEffect(() => {
    const fetchTemplate = async () => {
      const ref = doc(db, "templates", templateId);
      const snap = await getDoc(ref);
      if (snap.exists()) setTemplate(snap.data());
    };
    fetchTemplate();
  }, [templateId]);

  const mockEvent = {
    title: "Cumpleaños de Sofía",
    date: "2035-09-01T20:00:00",
    templateId,
    description: "¡Celebremos el cumpleaños de Sofía con una fiesta inolvidable!",
    hosts: [
      {
        name: "Sofía González",
        contactInfo: {
          email: "correo@ejemplo.com",
          phone: "+52 55 1234 5678"
        }
      },
      {
        name: "Carlos Ramírez",
        contactInfo: {
          email: "correo@ejemplo.com",
          phone: "+52 55 8765 4321"
        }
      }
    ],
    location: {
      ceremony: {
        street: "Calle de la Amargura",
        number: "123",
        neighborhood: "Centro Histórico",
        state: "CDMX",
        city: "Ciudad de México",
        postalCode: "06000"
      },
      reception: {
        street: "Av. P.º de la Reforma",
        number: "500",
        neighborhood: "Juárez",
        state: "Cuauhtémoc",
        city: "CDMX",
        postalCode: "06600"
      }
    }
  };

  const mockGuests = [
    "Alejandro Pérez",
    "Miranda López",
    "Samantha Martínez",
    "Iker Fernández"
  ];

  if (!template) return <p className="text-center mt-10">Cargando plantilla...</p>;

  const TemplateComponent = TEMPLATE_COMPONENTS[template.component]; // Aquí podrías usar un registry dinámico más adelante
  if (!TemplateComponent) return <p>Error: plantilla no registrada</p>;


  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h3 className="text-2xl font-bold text-white mb-6">Vista previa de la plantilla</h3>
      <TemplateComponent eventData={mockEvent} guests={mockGuests} />
      <div className="mt-4 flex justify-center gap-4">
        <button
          onClick={() => navigate("/create-event")}
          className="bg-gray-300 px-4 py-2 rounded"
        >
          Elegir otra plantilla
        </button>
        <button
          onClick={() => navigate(`/create-event/${templateId}`)}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Usar esta plantilla
        </button>
      </div>
    </div>
  );
}
