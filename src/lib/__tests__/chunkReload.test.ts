import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from '@/lib/chunkReload';

describe('isChunkLoadError', () => {
  it('detecta errores típicos de chunk tras deploy', () => {
    expect(
      isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/assets/foo.js'))
    ).toBe(true);
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/bar.css'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 5 failed'))).toBe(true);
    expect(isChunkLoadError(new Error('ChunkLoadError'))).toBe(true);
  });

  it('no marca errores de negocio normales', () => {
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false);
    expect(isChunkLoadError(new Error('Permission denied'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
