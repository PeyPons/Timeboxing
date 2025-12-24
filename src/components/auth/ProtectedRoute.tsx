import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react"; // Usamos un icono de carga

export const ProtectedRoute = () => {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. Verificación inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });

    // 2. Suscripción a cambios (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // MIENTRAS CARGA: Mostramos Spinner en vez de "nada" (null)
  if (session === null) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 text-sm font-medium animate-pulse">Verificando sesión...</p>
      </div>
    );
  }

  // SI NO HAY SESIÓN: Al Login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // SI HAY SESIÓN: Renderizamos la app
  return <Outlet />;
};
