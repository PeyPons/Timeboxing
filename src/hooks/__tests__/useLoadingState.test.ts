import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoadingState } from '../useLoadingState';

describe('useLoadingState', () => {
  it('debe inicializar sin estados de carga', () => {
    const { result } = renderHook(() => useLoadingState());

    expect(result.current.isLoading()).toBe(false);
    expect(result.current.isLoading('key1')).toBe(false);
  });

  it('debe establecer estado de carga', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.startLoading('key1');
    });

    expect(result.current.isLoading('key1')).toBe(true);
    expect(result.current.isLoading()).toBe(true);
  });

  it('debe detener estado de carga', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.startLoading('key1');
      result.current.stopLoading('key1');
    });

    expect(result.current.isLoading('key1')).toBe(false);
    expect(result.current.isLoading()).toBe(false);
  });

  it('debe manejar múltiples estados de carga', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.startLoading('key1');
      result.current.startLoading('key2');
      result.current.stopLoading('key1');
    });

    expect(result.current.isLoading('key1')).toBe(false);
    expect(result.current.isLoading('key2')).toBe(true);
    expect(result.current.isLoading()).toBe(true);
  });

  it('debe ejecutar operación con withLoading', async () => {
    const { result } = renderHook(() => useLoadingState());
    const mockOperation = vi.fn().mockResolvedValue('result');

    let operationResult: string | undefined;

    await act(async () => {
      operationResult = await result.current.withLoading('key1', mockOperation);
    });

    expect(mockOperation).toHaveBeenCalled();
    expect(operationResult).toBe('result');
    expect(result.current.isLoading('key1')).toBe(false);
  });
});

