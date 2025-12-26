import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger, LogLevel } from '../logger';

describe('Logger', () => {
  beforeEach(() => {
    logger.clearHistory();
    vi.clearAllMocks();
  });

  describe('info', () => {
    it('debe registrar mensajes de información', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Test message', { data: 'test' }, 'TestContext');
      
      expect(consoleSpy).toHaveBeenCalled();
      const history = logger.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].level).toBe(LogLevel.INFO);
      expect(history[0].message).toBe('Test message');
      
      consoleSpy.mockRestore();
    });
  });

  describe('error', () => {
    it('debe registrar errores', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const testError = new Error('Test error');
      logger.error('Error occurred', testError, 'TestContext');
      
      expect(consoleSpy).toHaveBeenCalled();
      const history = logger.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].level).toBe(LogLevel.ERROR);
      
      consoleSpy.mockRestore();
    });
  });

  describe('warn', () => {
    it('debe registrar advertencias', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('Warning message', { data: 'test' }, 'TestContext');
      
      expect(consoleSpy).toHaveBeenCalled();
      const history = logger.getHistory();
      expect(history[0].level).toBe(LogLevel.WARN);
      
      consoleSpy.mockRestore();
    });
  });

  describe('debug', () => {
    it('debe registrar mensajes de debug solo en desarrollo', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      logger.debug('Debug message', { data: 'test' }, 'TestContext');
      
      // En desarrollo debería llamar a console.debug
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('getHistory', () => {
    it('debe retornar historial de logs', () => {
      logger.info('Message 1');
      logger.warn('Message 2');
      
      const history = logger.getHistory();
      expect(history.length).toBe(2);
    });
  });

  describe('clearHistory', () => {
    it('debe limpiar el historial', () => {
      logger.info('Message 1');
      logger.clearHistory();
      
      const history = logger.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('exportLogs', () => {
    it('debe exportar logs en formato JSON', () => {
      logger.info('Test message');
      const exported = logger.exportLogs();
      
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });
});

