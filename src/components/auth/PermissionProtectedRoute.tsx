import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useApp } from '@/contexts/AppContext';
import { Loader2 } from 'lucide-react';

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
  const { currentUser, isLoading } = useApp();

  // Esperar a que termine de cargar antes de hacer redirecciones
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 text-sm font-medium animate-pulse">Cargando...</p>
      </div>
    );
  }

  // Solo después de cargar, verificar si hay usuario
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si se especifica un permiso requerido, verificar
  if (requiredPermission) {
    const hasPermission = canAccess(requiredPermission);
    if (!hasPermission) {
      // Redirigir a la página principal si no tiene permiso
      return <Navigate to="/" replace />;
    }
  } else {
    // Si no se especifica permiso, verificar por la ruta actual
    const hasAccess = canAccess(location.pathname);
    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

