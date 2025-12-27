import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const ProtectedRoute = () => {
  const { session, loading, isInitialized } = useAuth();
  const location = useLocation();

  // Mientras se inicializa la autenticación, mostrar spinner
  if (!isInitialized || loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin opacity-60" />
      </div>
    );
  }

  // Si no hay sesión, redirigir al login preservando la ruta original
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si hay sesión, renderizar la ruta protegida
  return <Outlet />;
};
