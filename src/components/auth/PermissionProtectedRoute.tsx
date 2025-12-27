import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo, useEffect, useState } from 'react';

interface PermissionProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

/**
 * Componente que protege rutas basándose en permisos del usuario
 */
export function PermissionProtectedRoute({ children, requiredPermission }: PermissionProtectedRouteProps) {
  const location = useLocation();
  const { canAccess } = usePermissions();
  const { currentUser, isLoading: isAppLoading, employees } = useApp();
  const { session, isInitialized: isAuthInitialized } = useAuth();
  
  // Estado para dar tiempo a la vinculación
  const [hasWaitedForLink, setHasWaitedForLink] = useState(false);

  // Dar un pequeño margen de tiempo para que AppContext vincule el usuario
  useEffect(() => {
    if (isAuthInitialized && !isAppLoading && session && !currentUser && employees.length > 0) {
      // Si tenemos sesión, employees cargados, pero no currentUser, esperar un momento
      const timeout = setTimeout(() => {
        setHasWaitedForLink(true);
      }, 500); // Esperar 500ms para la vinculación
      return () => clearTimeout(timeout);
    } else if (currentUser) {
      // Si ya tenemos currentUser, no necesitamos esperar
      setHasWaitedForLink(true);
    }
  }, [isAuthInitialized, isAppLoading, session, currentUser, employees]);

  // Determinar si todavía estamos en proceso de carga
  const isStillLoading = useMemo(() => {
    // Si auth no está inicializado, seguimos cargando
    if (!isAuthInitialized) return true;
    // Si AppContext está cargando, seguimos cargando
    if (isAppLoading) return true;
    // Si hay sesión pero aún no hemos esperado para la vinculación
    if (session && !currentUser && !hasWaitedForLink) return true;
    return false;
  }, [isAuthInitialized, isAppLoading, session, currentUser, hasWaitedForLink]);

  // Mientras carga, mostrar spinner
  if (isStillLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin opacity-60" />
      </div>
    );
  }

  // Si no hay sesión, redirigir al login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si hay sesión pero no se encontró el empleado vinculado (después de esperar)
  if (!currentUser) {
    // Solo loguear en desarrollo, no en cada render
    if (process.env.NODE_ENV === 'development') {
      console.warn('[PermissionProtectedRoute] Sesión activa pero sin empleado vinculado. Redirigiendo a /');
    }
    return <Navigate to="/" replace />;
  }

  // Verificar permisos
  const permissionToCheck = requiredPermission || location.pathname;
  const hasPermission = canAccess(permissionToCheck);

  if (!hasPermission) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
