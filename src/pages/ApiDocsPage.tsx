import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeft, ArrowRight, Code, Menu, BookOpen, Key, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localizedPathFromEs, pathEsToEn } from '@/i18n/publicPaths';
import { SeoTags } from '@/seo/SeoTags';
import { useIsMobile } from '@/hooks/use-mobile';
import { LanguageSelector } from '@/components/landing/LanguageSelector';
import { SidebarTOC } from './api-docs/components/SidebarTOC';
import { getAllSectionIds } from './api-docs/data/toc';

import { OverviewIntro } from './api-docs/sections/OverviewIntro';
import { OverviewAuth } from './api-docs/sections/OverviewAuth';
import { OverviewBaseUrl } from './api-docs/sections/OverviewBaseUrl';
import { OverviewWeeks } from './api-docs/sections/OverviewWeeks';
import { OverviewResponses } from './api-docs/sections/OverviewResponses';
import { OverviewRls } from './api-docs/sections/OverviewRls';
import { OverviewChangelog } from './api-docs/sections/OverviewChangelog';
import { TutorialQuickStart } from './api-docs/sections/TutorialQuickStart';
import { TutorialSyncTeam } from './api-docs/sections/TutorialSyncTeam';
import { TutorialPlanning } from './api-docs/sections/TutorialPlanning';
import { TutorialTimeTracking } from './api-docs/sections/TutorialTimeTracking';
import { TutorialTransfers } from './api-docs/sections/TutorialTransfers';
import { TutorialReports } from './api-docs/sections/TutorialReports';
import { TutorialAbsences } from './api-docs/sections/TutorialAbsences';
import { TutorialConfiguration } from './api-docs/sections/TutorialConfiguration';
import { TutorialFeedback } from './api-docs/sections/TutorialFeedback';
import { TutorialGoals } from './api-docs/sections/TutorialGoals';
import { TutorialLocks } from './api-docs/sections/TutorialLocks';
import { SdkSection } from './api-docs/sections/SdkSection';
import { OpenApiSection } from './api-docs/sections/OpenApiSection';
import { RestSection } from './api-docs/sections/RestSection';
import { FilteringSection } from './api-docs/sections/FilteringSection';
import { RealtimeSection } from './api-docs/sections/RealtimeSection';
import { ResourceReference } from './api-docs/sections/ResourceReference';

function useScrollSpy() {
  const location = useLocation();
  const navigate = useNavigate();
  const ids = getAllSectionIds();
  const hashId = location.hash.slice(1);
  const validHash = hashId && ids.includes(hashId);

  const [activeSection, setActiveSection] = useState(() => validHash ? hashId : 'intro');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isScrollingFromHashRef = useRef(false);

  const programmaticNavRef = useRef(false);

  const navigateToSection = (id: string) => {
    if (!ids.includes(id)) return;
    programmaticNavRef.current = true;
    navigate(`#${id}`, { replace: true });
    setActiveSection(id);
  };

  useEffect(() => {
    if (!validHash) return;
    setActiveSection(hashId);
    if (programmaticNavRef.current) {
      programmaticNavRef.current = false;
      isScrollingFromHashRef.current = true;
      setTimeout(() => { isScrollingFromHashRef.current = false; }, 800);
      return;
    }
    isScrollingFromHashRef.current = true;
    requestAnimationFrame(() => {
      const el = document.getElementById(hashId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(() => {
        isScrollingFromHashRef.current = false;
      }, 1200);
    });
  }, [hashId, validHash]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (isScrollingFromHashRef.current) return;
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const sorted = [...visible].sort(
          (a, b) => b.boundingClientRect.top - a.boundingClientRect.top,
        );
        const id = sorted[0].target.id;
        setActiveSection(id);
        const newHash = `#${id}`;
        if (window.location.hash !== newHash) {
          navigate(newHash, { replace: true });
        }
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: 0 },
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [navigate, ids]);

  return { activeSection, navigateToSection };
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 pt-4">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400/40">
        {title}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

export default function ApiDocsPage() {
  const { t, i18n } = useTranslation('apiDocs');
  const lang = i18n.language.startsWith('en') ? 'en' : 'es';
  const location = useLocation();
  const navigate = useNavigate();
  const { activeSection, navigateToSection } = useScrollSpy();
  const isMobile = useIsMobile();

  useEffect(() => {
    const hash = location.hash.slice(1);
    if (hash.startsWith('tag/')) {
      navigate(`${localizedPathFromEs('/api-docs/openapi', i18n.language)}#${hash}`, { replace: true });
    }
  }, [location.hash, navigate, i18n.language]);

  const pathHome = localizedPathFromEs('/', i18n.language);
  const pathGuide = localizedPathFromEs('/guia', i18n.language);
  const pathApiKeys = localizedPathFromEs('/api-keys', i18n.language);
  const pathLogin = localizedPathFromEs('/login', i18n.language);

  return (
    <>
      <SeoTags
        pathEs="/api-docs"
        pathEn={pathEsToEn('/api-docs')}
        title={t('seo.title')}
        description={t('seo.description')}
        lang={lang}
      />

      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"
            style={{ animationDuration: '4s' }}
          />
          <div
            className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"
            style={{ animationDuration: '6s', animationDelay: '1s' }}
          />
        </div>
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />

        <header className="fixed top-0 left-0 right-0 z-30 border-b border-white/10 bg-indigo-950/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 flex items-center justify-between h-14">
            <div className="flex items-center gap-1 sm:gap-2 md:gap-4 min-w-0 flex-1">
              {isMobile && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 bg-transparent border-0 text-white hover:bg-white/10 shrink-0"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="w-80 bg-indigo-950 border-white/10 p-6 overflow-y-auto"
                  >
                    <SheetTitle className="text-white text-lg font-bold mb-4">
                      {t('page.navSheetTitle')}
                    </SheetTitle>
                    <div className="flex gap-2 mb-5 pb-4 border-b border-white/10">
                      <Link to={pathHome} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white gap-1.5 text-xs">
                          <Home className="h-3.5 w-3.5" />
                          {t('page.home')}
                        </Button>
                      </Link>
                      <Link to={pathGuide} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white gap-1.5 text-xs">
                          <BookOpen className="h-3.5 w-3.5" />
                          {t('page.guide')}
                        </Button>
                      </Link>
                    </div>
                    <SidebarTOC activeSection={activeSection} onNavigate={navigateToSection} />
                  </SheetContent>
                </Sheet>
              )}
              {!isMobile && (
                <>
                  <Link to={pathHome}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/10 hover:text-white gap-1.5"
                    >
                      <ArrowLeft className="h-4 w-4 shrink-0" />
                      <span className="hidden sm:inline">{t('page.home')}</span>
                    </Button>
                  </Link>
                  <Link to={pathGuide}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/80 hover:bg-white/10 hover:text-white gap-1.5"
                    >
                      <BookOpen className="h-4 w-4 shrink-0" />
                      <span className="hidden sm:inline">{t('page.guide')}</span>
                    </Button>
                  </Link>
                  <span className="text-white/40 hidden sm:inline">|</span>
                </>
              )}
              <div className="flex items-center gap-1.5 sm:gap-2 text-white min-w-0">
                <Code className="h-4 w-4 text-indigo-300 shrink-0" />
                <span className="font-semibold text-xs sm:text-sm truncate">{t('page.apiDocsTitle')}</span>
                <span className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono shrink-0">
                  v1
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {!isMobile && (
                <Link to={pathApiKeys}>
                  <Button
                    size="sm"
                    className="bg-indigo-900/60 border border-indigo-400/40 text-indigo-100 hover:bg-indigo-800/70 hover:text-white gap-1.5"
                  >
                    <Key className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden lg:inline">{t('page.apiIntegrations')}</span>
                  </Button>
                </Link>
              )}
              <LanguageSelector />
              <Link to={pathLogin}>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 border-0 text-white hover:from-indigo-500 hover:to-purple-500 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200 gap-1.5 text-xs sm:text-sm px-2 sm:px-3"
                >
                  <span className="hidden sm:inline">{t('page.login')}</span>
                  <span className="sm:hidden">{t('page.loginShort')}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="h-14 shrink-0" aria-hidden />

        {!isMobile && (
          <aside
            className="fixed left-0 top-14 z-20 w-60 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-white/10 bg-indigo-950/95 backdrop-blur-xl"
            aria-label={t('page.sidebarAria')}
          >
            <div className="p-4 pb-12">
              <SidebarTOC activeSection={activeSection} onNavigate={navigateToSection} />
            </div>
          </aside>
        )}

        <div className={isMobile ? 'relative z-10 px-4 sm:px-6 py-8' : 'relative z-10 ml-60 min-h-screen'}>
          <main className={isMobile ? 'max-w-4xl mx-auto space-y-16' : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16'}>
            <OverviewIntro />
            <OverviewAuth />
            <OverviewBaseUrl />
            <OverviewWeeks />
            <OverviewResponses />
            <OverviewRls />
            <OverviewChangelog />

            <SectionDivider title={t('page.sectionTutorials')} />
            <TutorialQuickStart />
            <TutorialSyncTeam />
            <TutorialPlanning />
            <TutorialTimeTracking />
            <TutorialTransfers />
            <TutorialReports />
            <TutorialAbsences />
            <TutorialConfiguration />
            <TutorialFeedback />
            <TutorialGoals />
            <TutorialLocks />

            <SectionDivider title={t('page.sectionSdkRest')} />
            <SdkSection />
            <OpenApiSection />
            <RestSection />
            <FilteringSection />
            <RealtimeSection />

            <SectionDivider title={t('page.sectionReference')} />
            <ResourceReference />

            <div className="pt-8 border-t border-white/10 flex flex-wrap gap-4">
              <Link to={pathGuide}>
                <Button className="border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <BookOpen className="h-4 w-4 mr-2" />
                  {t('page.footerGuide')}
                </Button>
              </Link>
              <Link to={pathHome}>
                <Button className="border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  {t('page.footerHome')}
                </Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
