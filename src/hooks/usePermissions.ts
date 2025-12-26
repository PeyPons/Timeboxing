import { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { UserPermissions, ROUTE_PERMISSIONS, DEFAULT_PERMISSIONS } from '@/types/permissions';

/**
 * Hook para verificar permisos del usuario actual
 */
export function usePermissions() {
  const { currentUser } = useApp();

  const permissions = useMemo(() => {
    if (!currentUser) {
      return DEFAULT_PERMISSIONS;
    }
    return currentUser.permissions || DEFAULT_PERMISSIONS;
  }, [currentUser]);

  /**
   * Verifica si el usuario tiene permiso para acceder a una ruta
   */
  const canAccess = (route: string): boolean => {
    const permissionKey = ROUTE_PERMISSIONS[route];
    if (!permissionKey) {
      // Si la ruta no está en el mapeo, permitir acceso por defecto
      return true;
    }
    return permissions[permissionKey] !== false; // Por defecto true si no está definido
  };

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  const hasPermission = (permission: keyof UserPermissions): boolean => {
    return permissions[permission] !== false; // Por defecto true si no está definido
  };

  /**
   * Obtiene todos los permisos del usuario
   */
  const getAllPermissions = (): UserPermissions => {
    return permissions;
  };

  return {
    permissions,
    canAccess,
    hasPermission,
    getAllPermissions,
  };
}

