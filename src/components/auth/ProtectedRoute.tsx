import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = () => {
  const [session, setSession] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    // 1. Verificación inicial con un pequeño delay para evitar flash
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(!!session);
          setIsChecking(false);
        }
      } catch (error) {
        console.error('Error verificando sesión:', error);
        if (mounted) {
          setSession(false);
          setIsChecking(false);
        }
      }
    };

    // Pequeño delay para evitar flash durante la carga inicial
    const timeoutId = setTimeout(checkSession, 100);

    // 2. Suscripción a cambios (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(!!session);
        setIsChecking(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // MIENTRAS CARGA: Mostramos Spinner
  if (isChecking || session === null) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 text-sm font-medium animate-pulse">Verificando sesión...</p>
      </div>
    );
  }

  // SI NO HAY SESIÓN: Al Login (preservando la ruta de origen)
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // SI HAY SESIÓN: Renderizamos la app
  return <Outlet />;
};
