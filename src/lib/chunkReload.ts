/**
 * Recuperación tras deploy: chunks Vite con hash viejo fallan al navegar
 * (Failed to fetch dynamically imported module / CSS preload).
 * Recarga una sola vez por pestaña para evitar bucles infinitos.
 */

const RELOAD_FLAG_KEY = 'tb_chunk_deploy_reload';

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String((error as { message?: unknown })?.message ?? error);

  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to fetch dynamically imported module') ||
    normalized.includes('error loading dynamically imported module') ||
    normalized.includes('importing a module script failed') ||
    normalized.includes('unable to preload css') ||
    normalized.includes('loading chunk') ||
    normalized.includes('loading css chunk') ||
    normalized.includes('chunkloaderror')
  );
}

/** true si ya forzamos un reload en esta pestaña (evita bucle). */
export function hasForcedChunkReload(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearForcedChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG_KEY);
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * Si aún no hemos recargado por deploy en esta pestaña, marca flag y recarga.
 * @returns true si se disparó reload (la página va a morir).
 */
export function reloadOnceForNewDeploy(): boolean {
  if (hasForcedChunkReload()) return false;
  try {
    sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
  } catch {
    /* still try reload */
  }
  window.location.reload();
  return true;
}

/** Escucha el evento oficial de Vite 5+ para preloads rotos tras un deploy. */
export function installVitePreloadErrorHandler(): void {
  window.addEventListener('vite:preloadError', ((event: Event) => {
    event.preventDefault();
    reloadOnceForNewDeploy();
  }) as EventListener);
}
