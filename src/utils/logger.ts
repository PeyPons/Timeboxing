/**
 * Sistema de logging estructurado para Timeboxing
 * Reemplaza console.log/error/warn con logging estructurado
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  context?: string;
  timestamp: number;
  userAgent?: string;
  url?: string;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 100;

  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: any,
    context?: string
  ): LogEntry {
    return {
      level,
      message,
      data,
      context,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };
  }

  private addToHistory(entry: LogEntry) {
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
  }

  private formatMessage(entry: LogEntry): string {
    const contextStr = entry.context ? `[${entry.context}]` : '';
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    return `${entry.level} ${contextStr} ${entry.message}${dataStr}`;
  }

  /**
   * Log de información general
   */
  info(message: string, data?: any, context?: string) {
    const entry = this.createLogEntry(LogLevel.INFO, message, data, context);
    this.addToHistory(entry);
    
    if (this.isDevelopment) {
      console.log(`ℹ️ ${this.formatMessage(entry)}`);
    }
    
    // En producción, enviar a servicio de logging si está configurado
    // this.sendToLoggingService(entry);
  }

  /**
   * Log de errores
   */
  error(message: string, error?: Error | any, context?: string) {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name }
      : error;
    
    const entry = this.createLogEntry(LogLevel.ERROR, message, errorData, context);
    this.addToHistory(entry);
    
    console.error(`❌ ${this.formatMessage(entry)}`);
    
    // En producción, enviar a servicio de tracking de errores (Sentry, etc.)
    // this.sendToErrorTracking(entry);
  }

  /**
   * Log de advertencias
   */
  warn(message: string, data?: any, context?: string) {
    const entry = this.createLogEntry(LogLevel.WARN, message, data, context);
    this.addToHistory(entry);
    
    console.warn(`⚠️ ${this.formatMessage(entry)}`);
  }

  /**
   * Log de debug (solo en desarrollo)
   */
  debug(message: string, data?: any, context?: string) {
    if (!this.isDevelopment) return;
    
    const entry = this.createLogEntry(LogLevel.DEBUG, message, data, context);
    this.addToHistory(entry);
    
    console.debug(`🔍 ${this.formatMessage(entry)}`);
  }

  /**
   * Obtener historial de logs (útil para debugging)
   */
  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  /**
   * Limpiar historial de logs
   */
  clearHistory() {
    this.logHistory = [];
  }

  /**
   * Exportar logs para debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }
}

// Instancia singleton
export const logger = new Logger();

