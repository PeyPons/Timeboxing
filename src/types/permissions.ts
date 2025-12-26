/**
 * Definición de permisos disponibles en la aplicación
 */
export interface UserPermissions {
  can_access_planner?: boolean;
  can_access_projects?: boolean;
  can_access_clients?: boolean;
  can_access_team?: boolean;
  can_access_reports?: boolean;
  can_access_client_reports?: boolean;
  can_access_google_ads?: boolean;
  can_access_meta_ads?: boolean;
  can_access_ads_reports?: boolean;
  can_access_deadlines?: boolean;
}

/**
 * Mapeo de rutas a permisos
 */
export const ROUTE_PERMISSIONS: Record<string, keyof UserPermissions> = {
  '/planner': 'can_access_planner',
  '/projects': 'can_access_projects',
  '/clients': 'can_access_clients',
  '/team': 'can_access_team',
  '/reports': 'can_access_reports',
  '/informes-clientes': 'can_access_client_reports',
  '/ads': 'can_access_google_ads',
  '/meta-ads': 'can_access_meta_ads',
  '/ads-reports': 'can_access_ads_reports',
  '/deadlines': 'can_access_deadlines',
};

/**
 * Permisos por defecto (todos habilitados)
 */
export const DEFAULT_PERMISSIONS: UserPermissions = {
  can_access_planner: true,
  can_access_projects: true,
  can_access_clients: true,
  can_access_team: true,
  can_access_reports: true,
  can_access_client_reports: true,
  can_access_google_ads: true,
  can_access_meta_ads: true,
  can_access_ads_reports: true,
  can_access_deadlines: true,
};

/**
 * Etiquetas amigables para los permisos
 */
export const PERMISSION_LABELS: Record<keyof UserPermissions, string> = {
  can_access_planner: 'Planificador',
  can_access_projects: 'Proyectos',
  can_access_clients: 'Clientes',
  can_access_team: 'Equipo',
  can_access_reports: 'Reportes',
  can_access_client_reports: 'Informes de clientes',
  can_access_google_ads: 'Google Ads',
  can_access_meta_ads: 'Meta Ads',
  can_access_ads_reports: 'Informes automatizados',
  can_access_deadlines: 'Deadlines',
};

