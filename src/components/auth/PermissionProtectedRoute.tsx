import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

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
  const { currentUser, isLoading: isAppLoading } = useApp();
  const { session, isInitialized: isAuthInitialized } = useAuth();

  // Determinar si todavía estamos en proceso de carga
  const isStillLoading = useMemo(() => {
    // Si auth no está inicializado, seguimos cargando
    if (!isAuthInitialized) return true;
    // Si hay sesión pero AppContext aún está cargando, seguimos cargando
    if (session && isAppLoading) return true;
    // Si hay sesión pero currentUser aún no está disponible, esperamos un poco más
    if (session && !currentUser && isAppLoading) return true;
    return false;
  }, [isAuthInitialized, session, isAppLoading, currentUser]);

  // Mientras carga, mostrar spinner
  if (isStillLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin opacity-60" />
      </div>
    );
  }

  // Si no hay sesión (ya verificado por ProtectedRoute, pero por seguridad)
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si hay sesión pero no se encontró el empleado vinculado
  if (!currentUser) {
    console.warn('[PermissionProtectedRoute] Sesión activa pero sin empleado vinculado');
    // Redirigir a una página de error o al dashboard básico
    return <Navigate to="/" replace />;
  }

  // Verificar permisos
  const permissionToCheck = requiredPermission || location.pathname;
  const hasPermission = canAccess(permissionToCheck);

  if (!hasPermission) {
    // Redirigir a la página principal si no tiene permiso
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
