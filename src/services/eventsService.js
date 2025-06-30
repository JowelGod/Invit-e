// src/services/eventsService.js
import { db, auth } from "../firebaseConfig";
import { collection, doc, setDoc, getDoc, addDoc, serverTimestamp, updateDoc, query, where, getDocs } from "firebase/firestore";
import { deleteDoc } from "firebase/firestore";

// 🔸 Crear un nuevo evento
export const createEvent = async (eventData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    const newEvent = {
      ...eventData,
      ownerId: user.uid,
      collaborators: [],
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "events"), newEvent);
    return docRef.id;
  } catch (error) {
    console.error("Error al crear el evento:", error);
    throw error;
  }
};

// 🔸 Obtener evento por ID
export const getEventById = async (eventId) => {
  try {
    const docRef = doc(db, "events", eventId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      throw new Error("Evento no encontrado");
    }
  } catch (error) {
    console.error("Error al obtener el evento:", error);
    throw error;
  }
};

// 🔸 Agregar colaborador al evento
export const addCollaboratorToEvent = async (eventId, userId) => {
  try {
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);

    if (eventSnap.exists()) {
      const data = eventSnap.data();
      const updatedCollaborators = [...(data.collaborators || []), userId];

      await updateDoc(eventRef, {
        collaborators: updatedCollaborators
      });
    } else {
      throw new Error("Evento no encontrado");
    }
  } catch (error) {
    console.error("Error al agregar colaborador:", error);
    throw error;
  }
};

// 🔸 Obtener eventos donde el usuario es owner o colaborador
export const fetchUserEvents = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuario no autenticado");

    const eventsRef = collection(db, "events");

    // Eventos donde es dueño
    const ownedQuery = query(eventsRef, where("ownerId", "==", user.uid));
    const ownedSnap = await getDocs(ownedQuery);

    // Eventos donde es colaborador
    const sharedQuery = query(eventsRef, where("collaborators", "array-contains", user.uid));
    const sharedSnap = await getDocs(sharedQuery);

    // Unir y eliminar duplicados si aplica
    const allDocs = [...ownedSnap.docs, ...sharedSnap.docs];
    const uniqueEvents = new Map();

    allDocs.forEach((doc) => {
      uniqueEvents.set(doc.id, { id: doc.id, ...doc.data() });
    });

    return Array.from(uniqueEvents.values());
  } catch (error) {
    console.error("Error al obtener eventos del usuario:", error);
    return [];
  }
};

// 🔸 Eliminar evento por ID
export const deleteEvent = async (eventId) => {
  try {
    const eventRef = doc(db, "events", eventId);
    await deleteDoc(eventRef);
    console.log("Evento eliminado con éxito");
  } catch (error) {
    console.error("Error al eliminar el evento:", error);
    throw error;
  }
};

// 🔸 Actualizar evento por ID
export const updateEvent = async (id, updatedData) => {
  const ref = doc(db, "events", id);
  await updateDoc(ref, updatedData);
};
