import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { TEMPLATE_COMPONENTS } from "../templates/TemplateRegistry";

export default function CreateEvent() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [template, setTemplate] = useState(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      const snapshot = await getDocs(collection(db, "templates"));
      const result = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTemplates(result);
    };
    fetchTemplates();
  }, []);

  const handleSelect = (template) => {
    setSelected(template);
    setTimeout(() => navigate(`/evento/template-preview/${template.id}`), 300);
  };

  const grouped = templates.reduce((acc, templateItem) => {
    if (!acc[templateItem.label]) acc[templateItem.label] = [];
    acc[templateItem.label].push(templateItem);
    return acc;
  }, {});

  const mockEventData = {
    title: "Invitación moderna",
    date: "2025-07-18T20:00:00",
    location: {
      ceremony: {
        street: "Calle Falsa",
        number: "123",
        neighborhood: "Colonia",
        city: "CDMX",
        state: "CDMX",
        postalCode: "00000"
      }
    }
  };

  return (
    <div className="bg-white min-h-screen px-6 py-10">
      <div className="mb-4">
        <button
          onClick={() => navigate(`/dashboard`)}
          className="text-blue-600 hover:underline flex items-center"
        >
          ← Volver al dashboard
        </button>
      </div>
      <h1 className="text-3xl font-bold mb-12 text-center text-indigo-600">Selecciona una plantilla</h1>
      {Object.entries(grouped).map(([label, group]) => (
        <div key={label} className="mb-16">
          <h2 className="text-xl font-semibold mb-4 capitalize text-gray-700">{label}</h2>
          <div className="flex overflow-x-auto gap-6 pb-4 pr-4 scrollbar-hide">
            {group.map((templateItem) => {
              const Component = TEMPLATE_COMPONENTS[templateItem.component];
              return (
                <div
                  key={templateItem.id}
                  className="min-w-[320px] max-w-[320px] cursor-pointer hover:scale-105 transition shadow-lg rounded overflow-hidden border bg-white"
                  onClick={() => handleSelect(templateItem)}
                >
                  <div className="relative w-full h-[200px] bg-gray-100 overflow-hidden">
                    {Component ? (
                      <div className="absolute inset-0 overflow-x-auto scale-x-60 overflow-y-auto">
                        <Component
                          eventData={mockEventData}
                          guests={["Joel", "Valeria"]}
                          isPreview={true}
                        />
                      </div>
                    ) : (
                      <p className="text-center py-10 text-sm">Componente no encontrado</p>
                    )}
                    <div className="absolute top-0 left-0 bg-indigo-700 text-white text-xs font-bold px-2 py-1 rounded-br">
                      {label.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-center p-2">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {templateItem.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
