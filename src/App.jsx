import { Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseConfig";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute, { ProtectedRouteLogin } from "./components/ProtectedRoute";
import Header from "./components/Header";
import CreateEvent from "./pages/CreateEvent";
import EventForm from "./pages/EventForm";
import EventDetails from "./pages/EventDetails";
import GuestsManager from "./pages/GuestsManager";
import TemplatePreview from "./pages/TemplatePreview";
import GuestInvitation from "./pages/GuestInvitation";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  return (
      <>
            <Header />
            <div className="pt-20"> {/* margen superior para que no tape el header */}
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<ProtectedRouteLogin>
                  <Login /></ProtectedRouteLogin>} />
            <Route path="/register" element={<SignUp />} />
            <Route path="/dashboard" element={<ProtectedRoute>
                  <Dashboard /></ProtectedRoute>} />
            <Route path="/create-event" element={<ProtectedRoute>
                  <CreateEvent /></ProtectedRoute>} />
            <Route path="/create-event/:templateId" element={<ProtectedRoute>
                  <EventForm /></ProtectedRoute>} />
            <Route path="/evento/:id" element={<ProtectedRoute>
                  <EventDetails /></ProtectedRoute>} />
            <Route path="/evento/:id/invitados" element={<ProtectedRoute>
                  <GuestsManager /></ProtectedRoute>} />
            <Route path="/evento/template-preview/:templateId" element={<ProtectedRoute>
                  <TemplatePreview /></ProtectedRoute>} />
            <Route path="/evento/:eventId/edit" element={<ProtectedRoute>
                  <EventForm /></ProtectedRoute>} />
            <Route path="/invitacion/:guestId" element={<GuestInvitation />} />
            </Routes>
      </div>
</>
  );
}

export default App;
