import { useEffect, useLayoutEffect } from 'react';
import { useAgency } from '@/contexts/AgencyContext';
import { BRANDING_STORAGE_KEY } from '@/utils/earlyBrandingScript';

// Helper: Convertir Hex a HSL (formato para Tailwind: "H S% L%")
function hexToHSL(hex: string): string {
    let r = 0, g = 0, b = 0;
    // Expande shorthand form (e.g. "03F") a full form (e.g. "0033FF")
    if (hex.length === 4) {
        r = parseInt("0x" + hex[1] + hex[1]);
        g = parseInt("0x" + hex[2] + hex[2]);
        b = parseInt("0x" + hex[3] + hex[3]);
    } else if (hex.length === 7) {
        r = parseInt("0x" + hex[1] + hex[2]);
        g = parseInt("0x" + hex[3] + hex[4]);
        b = parseInt("0x" + hex[5] + hex[6]);
    }

    r /= 255;
    g /= 255;
    b /= 255;

    const cmin = Math.min(r, g, b),
        cmax = Math.max(r, g, b),
        delta = cmax - cmin;
    let h = 0, s = 0, l = 0;

    if (delta === 0)
        h = 0;
    else if (cmax === r)
        h = ((g - b) / delta) % 6;
    else if (cmax === g)
        h = (b - r) / delta + 2;
    else
        h = (r - g) / delta + 4;

    h = Math.round(h * 60);

    if (h < 0)
        h += 360;

    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return `${h} ${s}% ${l}%`;
}

// Helper: Calcular color de texto (blanco o negro) según background
function getContrastHSL(hex: string): string {
    if (hex.length !== 7 && hex.length !== 4) return '210 40% 98%'; // default light

    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt("0x" + hex[1] + hex[1]);
        g = parseInt("0x" + hex[2] + hex[2]);
        b = parseInt("0x" + hex[3] + hex[3]);
    } else {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }

    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '222.2 47.4% 11.2%' : '210 40% 98%'; // foreground default dark / light
}

// Aplicar color al DOM
function applyBrandingColor(primaryColor: string) {
    try {
        const hsl = hexToHSL(primaryColor);
        const foregroundHsl = getContrastHSL(primaryColor);

        document.documentElement.style.setProperty('--primary', hsl);
        document.documentElement.style.setProperty('--primary-foreground', foregroundHsl);
        document.documentElement.style.setProperty('--ring', hsl);
    } catch (e) {
        console.error('Error applying branding color:', e);
    }
}

export function BrandingEffect() {
    const { currentAgency } = useAgency();

    // useLayoutEffect se ejecuta antes del primer paint, evitando el flash
    useLayoutEffect(() => {
        // Primero, intentar aplicar el color guardado en localStorage inmediatamente
        const savedColor = localStorage.getItem(BRANDING_STORAGE_KEY);
        if (savedColor) {
            applyBrandingColor(savedColor);
        }
    }, []);

    // Cuando la agencia cargue, actualizar el color y guardarlo
    useEffect(() => {
        if (currentAgency?.settings?.branding?.primaryColor) {
            const primaryColor = currentAgency.settings.branding.primaryColor;
            applyBrandingColor(primaryColor);
            // Guardar en localStorage para la próxima carga
            localStorage.setItem(BRANDING_STORAGE_KEY, primaryColor);
        }
    }, [currentAgency]);

    return null;
}
