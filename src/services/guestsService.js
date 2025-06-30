// src/services/guestsService.js
import { db, auth } from "../firebaseConfig";
import { collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp } from "firebase/firestore";


export const addGuestToEvent = async (eventId, guestData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuario no autenticado");

    const timestamp = serverTimestamp();

    const newGuest = {
      eventId,                      // 🔹 Referencia explícita al evento
      groupName: guestData.groupName,
      ticketCount: guestData.ticketCount,
      guests: guestData.guests,    // 🔸 Lista de invitados con nombre/apellido
      contactInfo: {
        email: guestData.contactInfo?.email || "",
        phone: guestData.contactInfo?.phone || "",},
      confirmedCount: 0,           // Inicialmente nadie ha confirmado
      rejectedCount: 0,
      pendingCount: guestData.ticketCount,
      responded: false,
      status: "pending",           // Estado general del grupo
      invitedBy: user.uid,         // UID del planner o cliente que lo creó
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const docRef = await addDoc(collection(db, "guests"), newGuest);
    return docRef.id;
  } catch (error) {
    console.error("Error al agregar invitado:", error);
    throw error;
  }
};

export const deleteGuest = async (guestId) => {
  const guestRef = doc(db, "guests", guestId);
  await deleteDoc(guestRef);
};

export const fetchGuestsByEvent = async (eventId) => {
  const q = query(collection(db, "guests"), where("eventId", "==", eventId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateGuest = async (guestId, guestData) => {
  const guestRef = doc(db, "guests", guestId);

  // Calcular estado general
  let status = "pending";
  if (guestData.confirmedCount === guestData.ticketCount) {
    status = "confirmed";
  } else if (guestData.rejectedCount === guestData.ticketCount) {
    status = "rejected";
  } else if (
    guestData.confirmedCount > 0 ||
    guestData.rejectedCount > 0
  ) {
    status = "partial";
  }

  // Actualización
  await updateDoc(guestRef, {
    ...guestData,
    status,
    responded: true,
    updatedAt: serverTimestamp(),
  });
};
