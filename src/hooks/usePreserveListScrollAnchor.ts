import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import {
  LIST_SCROLL_ANCHOR_ATTR,
  captureListScrollAnchor,
  computeScrollCorrection,
  pickAnchorToRestore,
  type ListScrollAnchorSnapshot,
} from '@/utils/listScrollAnchor';

function readItemsFromContainer(container: HTMLElement) {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(`[${LIST_SCROLL_ANCHOR_ATTR}]`));
  return nodes
    .map((el) => {
      const id = el.getAttribute(LIST_SCROLL_ANCHOR_ATTR);
      if (!id) return null;
      const rect = el.getBoundingClientRect();
      return { id, top: rect.top, bottom: rect.bottom };
    })
    .filter((item): item is { id: string; top: number; bottom: number } => item != null);
}

function getViewportTopInset(): number {
  if (typeof window === 'undefined') return 0;
  return window.matchMedia('(max-width: 1023px)').matches ? 64 : 0;
}

/**
 * Conserva el proyecto (o fila) que el usuario tenía a la vista cuando la lista
 * cambia por datos remotos. No restaura si cambia `resetKey` (mes, filtros, búsqueda).
 */
export function usePreserveListScrollAnchor(params: {
  containerRef: RefObject<HTMLElement | null>;
  resetKey: string;
  layoutKey: string;
  recaptureKey?: string;
  disabled?: boolean;
}) {
  const { containerRef, resetKey, layoutKey, recaptureKey = '', disabled = false } = params;
  const snapshotRef = useRef<ListScrollAnchorSnapshot | null>(null);
  const prevResetKeyRef = useRef(resetKey);

  const recapture = () => {
    const root = containerRef.current;
    if (!root) {
      snapshotRef.current = null;
      return;
    }
    const items = readItemsFromContainer(root);
    snapshotRef.current = captureListScrollAnchor({
      items,
      viewportTop: getViewportTopInset(),
      viewportBottom: typeof window === 'undefined' ? 0 : window.innerHeight,
    });
  };

  useEffect(
    () => {
      if (disabled || typeof window === 'undefined') return;
      recapture();
      const onScrollOrResize = () => recapture();
      window.addEventListener('scroll', onScrollOrResize, { passive: true });
      window.addEventListener('resize', onScrollOrResize);
      return () => {
        window.removeEventListener('scroll', onScrollOrResize);
        window.removeEventListener('resize', onScrollOrResize);
      };
    },
    // recapture lee refs actuales; re-bind solo al habilitar la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- containerRef es estable
    [disabled],
  );

  useLayoutEffect(
    () => {
      const resetChanged = prevResetKeyRef.current !== resetKey;
      prevResetKeyRef.current = resetKey;

      if (disabled || resetChanged) {
        recapture();
        return;
      }

      const snapshot = snapshotRef.current;
      const root = containerRef.current;
      if (!snapshot || !root || typeof window === 'undefined') {
        recapture();
        return;
      }

      const items = readItemsFromContainer(root);
      const anchor = pickAnchorToRestore(snapshot, items);
      if (!anchor) {
        recapture();
        return;
      }

      const target = items.find((item) => item.id === anchor.id);
      if (!target) {
        recapture();
        return;
      }

      const delta = computeScrollCorrection(target.top, anchor.offsetFromViewport);
      if (Math.abs(delta) >= 1) {
        window.scrollBy(0, delta);
      }
      recapture();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recapture usa refs
    [layoutKey, resetKey, disabled],
  );

  useLayoutEffect(
    () => {
      recapture();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recapture usa refs
    [recaptureKey, disabled],
  );
}
