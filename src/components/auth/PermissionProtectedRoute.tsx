import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useApp } from '@/contexts/AppContext';

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
  const { currentUser } = useApp();

  // Si no hay usuario, redirigir a login
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

