/**
 * lazy() de React con recuperación tras deploy (chunks Vite con hash obsoleto).
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import {
  clearForcedChunkReloadFlag,
  isChunkLoadError,
  reloadOnceForNewDeploy,
} from '@/lib/chunkReload';

type DefaultExportModule = { default: ComponentType<unknown> };

export function lazyWithRetry(
  importFn: () => Promise<DefaultExportModule>
): LazyExoticComponent<ComponentType<unknown>> {
  return lazy(async () => {
    try {
      const mod = await importFn();
      // Carga OK: permitir un futuro reload si hay otro deploy en esta pestaña.
      clearForcedChunkReloadFlag();
      return mod;
    } catch (error) {
      console.error('Error cargando módulo:', error);
      if (isChunkLoadError(error) && reloadOnceForNewDeploy()) {
        return {
          default: function ChunkReloadPlaceholder() {
            return null;
          },
        };
      }
      throw error;
    }
  });
}
