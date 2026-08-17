import { describe, expect, it } from 'vitest';
import {
  captureListScrollAnchor,
  computeScrollCorrection,
  pickAnchorToRestore,
} from '@/utils/listScrollAnchor';

describe('captureListScrollAnchor', () => {
  const items = [
    { id: 'a', top: 40, bottom: 180 },
    { id: 'b', top: 196, bottom: 336 },
    { id: 'c', top: 352, bottom: 492 },
  ];

  it('captura todos los ítems que intersectan el viewport', () => {
    const snapshot = captureListScrollAnchor({
      items,
      viewportTop: 0,
      viewportBottom: 400,
    });
    expect(snapshot?.visible.map((v) => v.id)).toEqual(['a', 'b', 'c']);
    expect(snapshot?.visible[1]).toEqual({ id: 'b', offsetFromViewport: 196 });
  });

  it('omite ítems completamente por encima del inset (cabecera fija)', () => {
    const snapshot = captureListScrollAnchor({
      items: [
        { id: 'a', top: -120, bottom: 20 },
        { id: 'b', top: 36, bottom: 176 },
      ],
      viewportTop: 64,
      viewportBottom: 800,
    });
    expect(snapshot?.visible.map((v) => v.id)).toEqual(['b']);
  });
});

describe('pickAnchorToRestore', () => {
  const snapshot = captureListScrollAnchor({
    items: [
      { id: 'a', top: 80, bottom: 200 },
      { id: 'b', top: 216, bottom: 336 },
      { id: 'c', top: 352, bottom: 472 },
    ],
    viewportTop: 0,
    viewportBottom: 500,
  })!;

  it('si desaparece el proyecto de arriba, mantiene el que seguía a la vista', () => {
    const anchor = pickAnchorToRestore(snapshot, [
      { id: 'b', top: 80 },
      { id: 'c', top: 216 },
    ]);
    expect(anchor).toEqual({ id: 'b', offsetFromViewport: 216 });
  });

  it('si el de arriba se reordena al final, ancla el que el usuario seguía viendo', () => {
    const anchor = pickAnchorToRestore(snapshot, [
      { id: 'b', top: 80 },
      { id: 'c', top: 216 },
      { id: 'a', top: 5000 },
    ]);
    expect(anchor?.id).toBe('b');
    expect(anchor?.offsetFromViewport).toBe(216);
  });

  it('si desaparecen todos los visibles, coloca el siguiente donde estaba el primero', () => {
    const onlyAVisible = captureListScrollAnchor({
      items: [
        { id: 'a', top: 80, bottom: 700 },
        { id: 'b', top: 716, bottom: 856 },
      ],
      viewportTop: 0,
      viewportBottom: 700,
    })!;
    const anchor = pickAnchorToRestore(onlyAVisible, [{ id: 'b', top: 80 }]);
    expect(anchor).toEqual({ id: 'b', offsetFromViewport: 80 });
  });

  it('devuelve null si no queda ningún ítem', () => {
    expect(pickAnchorToRestore(snapshot, [])).toBeNull();
  });
});

describe('computeScrollCorrection', () => {
  it('desplaza hacia arriba si el ancla subió en el documento (ítem superior desapareció)', () => {
    // B estaba a 216px; tras quitar A ahora está a 80px → hay que restar 136 al scroll
    expect(computeScrollCorrection(80, 216)).toBe(-136);
  });

  it('no corrige si el ancla no se movió', () => {
    expect(computeScrollCorrection(216, 216)).toBe(0);
  });
});
