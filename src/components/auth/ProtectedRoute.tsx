import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export const ProtectedRoute = () => {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. Chequeo inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });

    // 2. Escuchar cambios en vivo (ej: si cierras sesión en otra pestaña)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Spinner de carga mientras verifica (para que no parpadee el login)
  if (session === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  // Si no hay sesión -> Al Login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Si hay sesión -> Muestra la App
  return <Outlet />;
};
