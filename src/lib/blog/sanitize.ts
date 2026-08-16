import DOMPurify, { type Config } from "dompurify";

const ALLOWED_TAGS = [
  "a", "b", "br", "code", "em", "i", "p", "span", "strong", "sub", "sup",
  "u", "small", "mark", "abbr", "cite", "kbd",
];

const ALLOWED_TAGS_FULL = [
  ...ALLOWED_TAGS,
  "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
  "img", "figure", "figcaption",
  "div",
];

const ALLOWED_ATTR = [
  "href", "title", "target", "rel",
  "class", "id",
  "aria-label", "aria-hidden", "role",
  "src", "alt", "width", "height", "loading",
  "colspan", "rowspan",
];

const PURIFY_CONFIG_INLINE: Config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
};

const PURIFY_CONFIG_FULL: Config = {
  ALLOWED_TAGS: ALLOWED_TAGS_FULL,
  ALLOWED_ATTR,
};

const GESTION_CAPSULE_HREFS: Record<string, string> = {
  "1": "/blog/planificacion-proyectos-cronograma-recursos",
  "2": "/blog/kpis-agencias-marketing-2026",
  "3": "/blog/ley-parkinson",
};

/** Convierte marcadores legacy de i18n (<Link>, <LocaleLinkN>) a enlaces HTML antes de sanitizar. */
function normalizeLegacyBlogHtml(input: string): string {
  return input
    .replace(/<Link\s+to="([^"]+)"/gi, '<a href="$1"')
    .replace(/<\/Link>/gi, "</a>")
    .replace(
      /<LocaleLink(\d*)>([\s\S]*?)<\/Link\d*>/gi,
      (_m, num: string, label: string) => {
        const href = GESTION_CAPSULE_HREFS[num] ?? "#";
        return `<a href="${href}">${label}</a>`;
      },
    )
    .replace(/<LocaleLink>([\s\S]*?)<\/LocaleLink>/gi, '<a href="#">$1</a>');
}

/** Sanitiza HTML inline (parrafos, items de lista, callouts): solo formato basico + enlaces. */
export function sanitizeInlineHtml(input: string): string {
  return DOMPurify.sanitize(normalizeLegacyBlogHtml(input), PURIFY_CONFIG_INLINE);
}

/** Sanitiza HTML libre (bloque html): permite estructura mas amplia, sigue sin scripts ni event handlers. */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, PURIFY_CONFIG_FULL);
}
