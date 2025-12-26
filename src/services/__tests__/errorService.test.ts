import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorService, ErrorType } from '../errorService';

describe('ErrorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createError', () => {
    it('debe crear un error estructurado', () => {
      const error = ErrorService.createError('Test error', ErrorType.VALIDATION, 'TestContext');
      
      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.message).toBe('Test error');
      expect(error.context).toBe('TestContext');
      expect(error.userMessage).toBeDefined();
    });

    it('debe marcar errores de red como recuperables', () => {
      const error = ErrorService.createError('Network error', ErrorType.NETWORK);
      expect(ErrorService.isRetryable(error)).toBe(true);
    });

    it('debe marcar errores de validación como no recuperables', () => {
      const error = ErrorService.createError('Validation error', ErrorType.VALIDATION);
      expect(ErrorService.isRetryable(error)).toBe(false);
    });
  });

  describe('getUserMessage', () => {
    it('debe retornar mensaje amigable para el usuario', () => {
      const error = ErrorService.createError('Test', ErrorType.NETWORK);
      const message = ErrorService.getUserMessage(error);
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });
  });

  describe('detectErrorType', () => {
    it('debe detectar errores de red', () => {
      const networkError = { message: 'fetch failed', code: 'ECONNREFUSED' };
      const error = ErrorService.handle(networkError, 'Test', { showToast: false });
      expect(error.type).toBe(ErrorType.NETWORK);
    });

    it('debe detectar errores de validación', () => {
      const validationError = { message: 'required field', code: '23505' };
      const error = ErrorService.handle(validationError, 'Test', { showToast: false });
      expect(error.type).toBe(ErrorType.VALIDATION);
    });

    it('debe detectar errores de autenticación', () => {
      const authError = { message: 'auth failed', status: 401 };
      const error = ErrorService.handle(authError, 'Test', { showToast: false });
      expect(error.type).toBe(ErrorType.AUTHENTICATION);
    });
  });
});

