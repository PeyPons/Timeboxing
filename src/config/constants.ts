/**
 * Constantes centralizadas del proyecto
 * Evita valores mágicos hardcodeados en el código
 */

export const CONSTANTS = {
  // Timeouts y delays
  TIMEOUTS: {
    TOUR_DELAY: 500,
    AUTO_SAVE_DEBOUNCE: 800,
    LOCK_RENEWAL: 20000, // 20 segundos
    LOCK_EXPIRATION: 60000, // 1 minuto
    LOCK_CLEANUP_INTERVAL: 60000, // 1 minuto
    SYNC_POLL_INTERVAL: 5000, // 5 segundos
    TOAST_DURATION: 3000, // 3 segundos
  },

  // Límites de datos
  LIMITS: {
    MAX_LOGS: 50,
    TOP_CAMPAIGNS: 10,
    MAX_TIPS: 3,
    MAX_HISTORICAL_MONTHS: 12,
    MAX_CHANGE_LOGS: 50,
    MAX_CAMPAIGN_ANALYSES: 10,
    MAX_REDISTRIBUTION_TIPS: 3,
    MAX_ABSENCE_DETAILS: 10,
    MAX_TEAM_EVENT_DETAILS: 10,
  },

  // UI
  UI: {
    MODAL_MAX_WIDTH: 'max-w-2xl',
    PRINT_PAGE_WIDTH: '210mm',
    PRINT_PAGE_HEIGHT: '297mm',
    PRINT_PADDING: '15mm',
    CHART_HEIGHT: 256, // px
    SCROLL_AREA_HEIGHT: 300, // px
  },

  // Colores y estilos
  COLORS: {
    LOAD_STATUS: {
      HEALTHY: 'emerald',
      WARNING: 'amber',
      CRITICAL: 'red',
    },
    BADGE: {
      ENABLED: 'default',
      DISABLED: 'secondary',
      ERROR: 'destructive',
    },
  },

  // Mensajes comunes
  MESSAGES: {
    LOADING: 'Cargando...',
    SAVING: 'Guardando...',
    SAVED: 'Guardado correctamente',
    ERROR: 'Ocurrió un error',
    SUCCESS: 'Operación exitosa',
    CONFIRM_DELETE: '¿Estás seguro de que quieres eliminar esto?',
    NO_DATA: 'No hay datos disponibles',
  },

  // Configuración de IA
  AI: {
    MAX_PROMPT_LENGTH: 1000,
    TEMPERATURE: 0.7,
    BATCH_SIZE: 3,
    MAX_RETRIES: 3,
  },

  // Configuración de sincronización
  SYNC: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000, // 2 segundos
    TIMEOUT: 30000, // 30 segundos
  },
} as const;

// Tipos derivados para TypeScript
export type LoadStatusColor = typeof CONSTANTS.COLORS.LOAD_STATUS[keyof typeof CONSTANTS.COLORS.LOAD_STATUS];
export type BadgeVariant = typeof CONSTANTS.COLORS.BADGE[keyof typeof CONSTANTS.COLORS.BADGE];

