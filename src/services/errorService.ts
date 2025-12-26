import { toast } from 'sonner';
import { logger } from '@/utils/logger';

/**
 * Tipos de errores comunes
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  PERMISSION = 'PERMISSION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Interfaz para errores estructurados
 */
export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: Error | any;
  context?: string;
  userMessage?: string;
  retryable?: boolean;
}

/**
 * Mensajes amigables para el usuario según el tipo de error
 */
const USER_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.NETWORK]: 'Error de conexión. Verifica tu internet e intenta de nuevo.',
  [ErrorType.VALIDATION]: 'Por favor, completa todos los campos correctamente.',
  [ErrorType.AUTHENTICATION]: 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.',
  [ErrorType.PERMISSION]: 'No tienes permisos para realizar esta acción.',
  [ErrorType.NOT_FOUND]: 'No se encontró el recurso solicitado.',
  [ErrorType.SERVER]: 'Error del servidor. Por favor, intenta más tarde.',
  [ErrorType.UNKNOWN]: 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
};

/**
 * Detecta el tipo de error basado en el error original
 */
function detectErrorType(error: any): ErrorType {
  if (!error) return ErrorType.UNKNOWN;

  // Errores de red
  if (error.message?.includes('fetch') || error.message?.includes('network') || error.code === 'ECONNREFUSED') {
    return ErrorType.NETWORK;
  }

  // Errores de validación
  if (error.message?.includes('validation') || error.message?.includes('required') || error.code === '23505') {
    return ErrorType.VALIDATION;
  }

  // Errores de autenticación
  if (error.message?.includes('auth') || error.status === 401 || error.code === 'PGRST301') {
    return ErrorType.AUTHENTICATION;
  }

  // Errores de permisos
  if (error.message?.includes('permission') || error.status === 403 || error.code === '42501') {
    return ErrorType.PERMISSION;
  }

  // Errores 404
  if (error.status === 404 || error.code === 'PGRST116') {
    return ErrorType.NOT_FOUND;
  }

  // Errores del servidor
  if (error.status >= 500 || error.code?.startsWith('PGRST')) {
    return ErrorType.SERVER;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Servicio centralizado de manejo de errores
 */
export class ErrorService {
  /**
   * Maneja un error de forma centralizada
   * @param error - El error a manejar
   * @param context - Contexto donde ocurrió el error (ej: "DeadlinesPage", "saveDeadline")
   * @param options - Opciones adicionales
   */
  static handle(
    error: Error | any,
    context: string,
    options?: {
      showToast?: boolean;
      logLevel?: 'error' | 'warn';
      userMessage?: string;
    }
  ): AppError {
    const errorType = detectErrorType(error);
    const userMessage = options?.userMessage || USER_MESSAGES[errorType];
    const showToast = options?.showToast !== false; // Por defecto mostrar toast

    const appError: AppError = {
      type: errorType,
      message: error?.message || 'Error desconocido',
      originalError: error,
      context,
      userMessage,
      retryable: errorType === ErrorType.NETWORK || errorType === ErrorType.SERVER,
    };

    // Logging estructurado
    if (options?.logLevel === 'warn') {
      logger.warn(`Error en ${context}`, error, context);
    } else {
      logger.error(`Error en ${context}`, error, context);
    }

    // Mostrar toast al usuario
    if (showToast) {
      toast.error(userMessage);
    }

    // En producción, enviar a servicio de tracking
    // this.trackError(appError);

    return appError;
  }

  /**
   * Maneja errores de forma silenciosa (solo logging, sin toast)
   */
  static handleSilently(error: Error | any, context: string): AppError {
    return this.handle(error, context, { showToast: false });
  }

  /**
   * Crea un error estructurado sin manejarlo automáticamente
   */
  static createError(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    context?: string
  ): AppError {
    return {
      type,
      message,
      context,
      userMessage: USER_MESSAGES[type],
      retryable: type === ErrorType.NETWORK || type === ErrorType.SERVER,
    };
  }

  /**
   * Verifica si un error es recuperable
   */
  static isRetryable(error: AppError): boolean {
    return error.retryable === true;
  }

  /**
   * Obtiene mensaje amigable para el usuario
   */
  static getUserMessage(error: AppError): string {
    return error.userMessage || USER_MESSAGES[error.type];
  }
}

