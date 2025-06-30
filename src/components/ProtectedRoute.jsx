import { Navigate } from "react-router-dom";
import { auth } from "../firebaseConfig";

export default function ProtectedRoute({ children }) {
  const user = auth.currentUser;
  return user ? children : <Navigate to="/login" />;
}

export function ProtectedRouteLogin({ children }) {
  const user = auth.currentUser;
  return !user ? children : <Navigate to="/dashboard" />;
}