import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormState } from '../useFormState';

describe('useFormState', () => {
  it('debe inicializar con datos por defecto', () => {
    const initialData = { name: 'Test', email: 'test@test.com' };
    const { result } = renderHook(() => useFormState(initialData));

    expect(result.current.formData).toEqual(initialData);
    expect(result.current.errors).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
  });

  it('debe actualizar un campo', () => {
    const { result } = renderHook(() => useFormState({ name: '', email: '' }));

    act(() => {
      result.current.updateField('name', 'New Name');
    });

    expect(result.current.formData.name).toBe('New Name');
  });

  it('debe limpiar errores al actualizar un campo', () => {
    const { result } = renderHook(() => useFormState({ name: '', email: '' }));

    act(() => {
      result.current.setFieldError('name', 'Error');
      expect(result.current.errors.name).toBe('Error');
      
      result.current.updateField('name', 'New Name');
    });

    expect(result.current.errors.name).toBeUndefined();
  });

  it('debe resetear el formulario', () => {
    const initialData = { name: 'Test', email: 'test@test.com' };
    const { result } = renderHook(() => useFormState(initialData));

    act(() => {
      result.current.updateField('name', 'Changed');
      result.current.setFieldError('email', 'Error');
      result.current.reset();
    });

    expect(result.current.formData).toEqual(initialData);
    expect(result.current.errors).toEqual({});
  });
});

