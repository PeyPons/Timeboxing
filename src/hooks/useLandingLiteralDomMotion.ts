import { useCallback, useRef } from "react";
import { animate } from "motion";

const STATUS_CYCLE_MS = 2800;
const STATUS_SLIDE_S = 0.45;

/**
 * Animaciones DOM sobre el HTML literal del hero (ticker infinito + rotación SVG + status ticker vertical).
 * Devuelve un callback ref para enganchar el `<section>`.
 *
 * Ignora `prefers-reduced-motion` — decorativo continuo, parte de la identidad visual.
 */
export function useLandingLiteralDomMotion(_reduceMotion: boolean | null) {
  const stopRef = useRef<Array<() => void>>([]);

  return useCallback(
    (root: HTMLElement | null) => {
      stopRef.current.forEach((fn) => fn());
      stopRef.current = [];
      if (!root) return;

      const ticker = root.querySelector<HTMLElement>(".js-landing-ticker");
      const orbit = root.querySelector<HTMLElement>(".js-landing-orbit-svg");

      if (ticker) {
        const ctrl = animate(0, -1600, {
          duration: 48,
          repeat: Infinity,
          ease: "linear",
          onUpdate: (v) => {
            ticker.style.transform = `translate3d(${v}px,0,0)`;
          },
        });
        stopRef.current.push(() => ctrl.stop());
      }

      if (orbit) {
        const ctrl = animate(0, 360, {
          duration: 96,
          repeat: Infinity,
          ease: "linear",
          onUpdate: (v) => {
            orbit.style.transform = `rotate(${v}deg)`;
          },
        });
        stopRef.current.push(() => ctrl.stop());
      }

      // Vertical status ticker (hero team stats)
      const statusContainer = root.querySelector<HTMLElement>("[data-hero-status-ticker]");
      if (statusContainer) {
        const items = Array.from(
          statusContainer.querySelectorAll<HTMLElement>("[data-hero-status-item]"),
        );
        if (items.length > 1) {
          let current = 0;
          let activeSlideStops: Array<() => void> = [];

          const setStatusItemState = (el: HTMLElement, visible: boolean) => {
            el.style.opacity = visible ? "1" : "0";
            el.style.transform = visible ? "translateY(0)" : "translateY(100%)";
          };

          items.forEach((el, i) => setStatusItemState(el, i === 0));

          const cycle = () => {
            activeSlideStops.forEach((stop) => stop());
            activeSlideStops = [];

            const prev = current;
            current = (current + 1) % items.length;
            const outEl = items[prev];
            const inEl = items[current];

            setStatusItemState(inEl, false);

            const ctrlOut = animate(0, 1, {
              duration: STATUS_SLIDE_S,
              ease: [0.22, 1, 0.36, 1],
              onUpdate: (p) => {
                outEl.style.opacity = String(1 - p);
                outEl.style.transform = `translateY(${-p * 100}%)`;
              },
            });
            activeSlideStops.push(() => ctrlOut.stop());

            const ctrlIn = animate(0, 1, {
              duration: STATUS_SLIDE_S,
              ease: [0.22, 1, 0.36, 1],
              onUpdate: (p) => {
                inEl.style.opacity = String(p);
                inEl.style.transform = `translateY(${(1 - p) * 100}%)`;
              },
            });
            activeSlideStops.push(() => ctrlIn.stop());
          };

          const statusCycleTimer = window.setInterval(cycle, STATUS_CYCLE_MS);
          stopRef.current.push(() => {
            window.clearInterval(statusCycleTimer);
            activeSlideStops.forEach((stop) => stop());
          });
        }
      }
    },
    [],
  );
}
