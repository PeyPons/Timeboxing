export interface VisibleListItem {
  id: string;
  top: number;
  bottom: number;
}

export interface VisibleListItemAnchor {
  id: string;
  offsetFromViewport: number;
}

export interface ListScrollAnchorSnapshot {
  visible: VisibleListItemAnchor[];
  orderedIds: string[];
}

/**
 * Captura los ítems que intersectan el viewport (por debajo de `viewportTop`).
 * El ancla preferida es el primer ítem aún visible tras un cambio de lista.
 */
export function captureListScrollAnchor(params: {
  items: VisibleListItem[];
  viewportTop: number;
  viewportBottom: number;
}): ListScrollAnchorSnapshot | null {
  const { items, viewportTop, viewportBottom } = params;
  if (items.length === 0) return null;

  const orderedIds = items.map((item) => item.id);
  const visible = items
    .filter((item) => item.bottom > viewportTop && item.top < viewportBottom)
    .map((item) => ({ id: item.id, offsetFromViewport: item.top }));

  if (visible.length > 0) {
    return { visible, orderedIds };
  }

  const firstBelow = items.find((item) => item.top >= viewportTop) ?? items[items.length - 1];
  return {
    visible: [{ id: firstBelow.id, offsetFromViewport: firstBelow.top }],
    orderedIds,
  };
}

/**
 * Elige qué ítem restaurar.
 * Entre los que seguían a la vista, el que menos se haya desplazado en el viewport
 * (si el de arriba se reordenó al final, no lo perseguimos).
 * Si todos los visibles desaparecieron, el siguiente (o anterior) en el orden original.
 */
export function pickAnchorToRestore(
  snapshot: ListScrollAnchorSnapshot,
  currentItems: Array<{ id: string; top: number }>,
): VisibleListItemAnchor | null {
  const currentById = new Map(currentItems.map((item) => [item.id, item.top]));
  const remainingCaptured = snapshot.visible.filter((anchor) => currentById.has(anchor.id));

  if (remainingCaptured.length > 0) {
    let best = remainingCaptured[0];
    let bestDelta = Math.abs((currentById.get(best.id) ?? 0) - best.offsetFromViewport);
    for (let i = 1; i < remainingCaptured.length; i++) {
      const candidate = remainingCaptured[i];
      const delta = Math.abs((currentById.get(candidate.id) ?? 0) - candidate.offsetFromViewport);
      if (delta < bestDelta) {
        best = candidate;
        bestDelta = delta;
      }
    }
    return best;
  }

  const remainingIds = new Set(currentById.keys());
  const firstCaptured = snapshot.visible[0];
  if (!firstCaptured) return null;

  const start = Math.max(0, snapshot.orderedIds.indexOf(firstCaptured.id));
  for (let i = start; i < snapshot.orderedIds.length; i++) {
    const id = snapshot.orderedIds[i];
    if (remainingIds.has(id)) {
      return { id, offsetFromViewport: firstCaptured.offsetFromViewport };
    }
  }
  for (let i = start - 1; i >= 0; i--) {
    const id = snapshot.orderedIds[i];
    if (remainingIds.has(id)) {
      return { id, offsetFromViewport: firstCaptured.offsetFromViewport };
    }
  }
  return null;
}

export function computeScrollCorrection(currentTop: number, targetOffsetFromViewport: number): number {
  return currentTop - targetOffsetFromViewport;
}

export const LIST_SCROLL_ANCHOR_ATTR = 'data-scroll-anchor-id';
