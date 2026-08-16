export const BRANDING_STORAGE_KEY = 'timeboxing_branding_color';

/** Script para inyectar en index.html y aplicar color antes de que cargue React. */
export function getEarlyBrandingScript(): string {
  return `
        (function() {
            try {
                var color = localStorage.getItem('${BRANDING_STORAGE_KEY}');
                if (color && color.length === 7 && color[0] === '#') {
                    // Conversión simplificada hex a HSL
                    var r = parseInt(color.substring(1,3), 16) / 255;
                    var g = parseInt(color.substring(3,5), 16) / 255;
                    var b = parseInt(color.substring(5,7), 16) / 255;
                    var max = Math.max(r, g, b), min = Math.min(r, g, b);
                    var h, s, l = (max + min) / 2;
                    if (max === min) { h = s = 0; }
                    else {
                        var d = max - min;
                        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                        switch(max) {
                            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                            case g: h = ((b - r) / d + 2) / 6; break;
                            case b: h = ((r - g) / d + 4) / 6; break;
                        }
                    }
                    h = Math.round(h * 360);
                    s = Math.round(s * 100);
                    l = Math.round(l * 100);
                    var hsl = h + ' ' + s + '% ' + l + '%';
                    document.documentElement.style.setProperty('--primary', hsl);
                    document.documentElement.style.setProperty('--ring', hsl);
                }
            } catch(e) {}
        })();
    `;
}
