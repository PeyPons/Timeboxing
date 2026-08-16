import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/landing/LanguageSelector';
import { SeoTags } from '@/seo/SeoTags';
import { localizedPathFromEs, pathEsToEn } from '@/i18n/publicPaths';

const OPENAPI_URL = '/openapi/taimbox-integration-api.json';
const REDOC_SCRIPT = 'https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js';
const REDOC_STYLE_ID = 'taimbox-redoc-overrides';

declare global {
  interface Window {
    Redoc?: {
      init: (
        specUrl: string,
        options: Record<string, unknown>,
        element: HTMLElement | null,
        callback?: () => void,
      ) => void;
    };
  }
}

function injectRedocOverrides() {
  if (document.getElementById(REDOC_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = REDOC_STYLE_ID;
  style.textContent = `
    .taimbox-redoc-root a[href="https://redocly.com/redoc/"] { display: none !important; }
  `;
  document.head.appendChild(style);
}

export default function OpenApiViewerPage() {
  const { t, i18n } = useTranslation('apiDocs');
  const lang = i18n.language.startsWith('en') ? 'en' : 'es';
  const containerRef = useRef<HTMLDivElement>(null);
  const apiDocsPath = localizedPathFromEs('/api-docs', i18n.language);

  useEffect(() => {
    injectRedocOverrides();
    const container = containerRef.current;
    if (!container) return undefined;

    let cancelled = false;

    const mountRedoc = () => {
      if (cancelled || !window.Redoc || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      window.Redoc.init(
        OPENAPI_URL,
        {
          scrollYOffset: 56,
          hideDownloadButton: false,
          expandResponses: '200,201',
          pathInMiddlePanel: false,
          theme: {
            colors: { primary: { main: '#4f46e5' } },
            typography: { fontSize: '15px', code: { fontSize: '13px' } },
            sidebar: { backgroundColor: '#fafafa' },
          },
        },
        containerRef.current,
      );
    };

    if (window.Redoc) {
      mountRedoc();
      return () => {
        cancelled = true;
        container.innerHTML = '';
      };
    }

    const existing = document.querySelector(`script[src="${REDOC_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', mountRedoc);
      if (window.Redoc) mountRedoc();
      return () => {
        cancelled = true;
        existing.removeEventListener('load', mountRedoc);
        container.innerHTML = '';
      };
    }

    const script = document.createElement('script');
    script.src = REDOC_SCRIPT;
    script.async = true;
    script.onload = mountRedoc;
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      container.innerHTML = '';
    };
  }, []);

  return (
    <>
      <SeoTags
        pathEs="/api-docs/openapi"
        pathEn={pathEsToEn('/api-docs/openapi')}
        title={t('openapi.viewerSeoTitle')}
        description={t('openapi.viewerSeoDescription')}
        lang={lang}
      />

      <div className="min-h-screen bg-white flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="max-w-[1600px] mx-auto px-4 h-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Link to={apiDocsPath}>
                <Button variant="ghost" size="sm" className="gap-1.5 shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('openapi.backToDocs')}</span>
                </Button>
              </Link>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <span className="text-sm font-semibold text-slate-800 truncate">
                {t('openapi.viewerTitle')}
              </span>
            </div>
            <LanguageSelector />
          </div>
        </header>

        <div className="pt-14 flex-1 taimbox-redoc-root">
          <div ref={containerRef} className="min-h-[calc(100vh-3.5rem)]" />
        </div>
      </div>
    </>
  );
}
