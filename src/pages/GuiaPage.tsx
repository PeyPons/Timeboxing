import { useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Users,
  BarChart3,
  Target,
  FileText,
  Clock,
  CheckCircle2,
  LayoutGrid,
  PieChart,
  TrendingUp,
  TrendingDown,
  Building2,
  Settings,
  Link2,
  Bell,
  Zap,
  ChevronRight,
  ChevronLeft,
  Home,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  Eye,
  MousePointerClick,
  Layers,
  GitBranch,
  Shield,
  Download,
  Filter,
  Pencil,
  Plus,
  Search,
  ToggleLeft,
  UserPlus,
  CalendarOff,
  Gauge,
  DollarSign,
  FolderOpen,
  Tag,
  Activity,
  Timer,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { cn } from '@/lib/utils';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { localizedPathFromEs, pathEsToEn } from '@/i18n/publicPaths';
import { i18nAsArray } from '@/lib/i18nReturnObjects';
import { SeoTags } from '@/seo/SeoTags';

/* ─── SECTIONS (iconos y gradientes fijos; títulos vía i18n) ─── */
type GuideSection = { slug: string; title: string; short: string; icon: React.ElementType; color: string };

const SECTION_META: { slug: string; icon: React.ElementType; color: string }[] = [
  { slug: 'planificador', icon: Calendar, color: 'from-indigo-500 to-purple-500' },
  { slug: 'mi-espacio', icon: LayoutGrid, color: 'from-purple-500 to-pink-500' },
  { slug: 'deadlines', icon: Target, color: 'from-amber-500 to-orange-500' },
  { slug: 'informes', icon: BarChart3, color: 'from-rose-500 to-pink-500' },
  { slug: 'weekly-forecast', icon: FileText, color: 'from-violet-500 to-purple-500' },
  { slug: 'equipo', icon: Users, color: 'from-blue-500 to-cyan-500' },
  { slug: 'tiempos', icon: Timer, color: 'from-teal-500 to-emerald-500' },
  { slug: 'clientes-proyectos', icon: Building2, color: 'from-slate-500 to-indigo-500' },
  { slug: 'configuracion', icon: Settings, color: 'from-slate-600 to-slate-800' },
];

function buildGuideSections(t: TFunction<'landing'>): GuideSection[] {
  return SECTION_META.map(({ slug, icon, color }) => ({
    slug,
    icon,
    color,
    title: t(`guide.sections.${slug}.title`),
    short: t(`guide.sections.${slug}.short`),
  }));
}

/* ─── LAYOUT ─── */
function GuiaLayout({ children, title, description }: { children: React.ReactNode; title?: string; description?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
      </div>
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />
      <LandingHeader />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {title && (
          <div className="mb-10">
            <h1 className="text-3xl sm:text-5xl font-black text-white mb-3">{title}</h1>
            {description && <p className="text-lg sm:text-xl text-indigo-200/90 max-w-2xl">{description}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ─── SECTION CARD (index) ─── */
function SectionCard({ slug, title, icon: Icon, short, color }: GuideSection) {
  const { i18n } = useTranslation('landing');
  return (
    <Link to={localizedPathFromEs(`/guia/${slug}`, i18n.language)} className="block">
      <Card className="border-2 border-white/15 bg-gradient-to-br from-indigo-900/90 to-purple-900/90 backdrop-blur-xl hover:border-white/40 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 group cursor-pointer">
        <CardContent className="p-5 sm:p-6 flex items-center gap-4 relative overflow-hidden">
          {/* Glow behind icon on hover */}
          <div className={cn("absolute -left-4 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full b lur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 bg-gradient-to-br", color)} />
          <div className={cn("relative w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300", color)}>
            <Icon className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0 relative">
            <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-indigo-200 transition-colors duration-200">{title}</h2>
            <p className="text-sm text-indigo-200/70 mt-0.5">{short}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/40 group-hover:text-white group-hover:translate-x-1 shrink-0 transition-all duration-300" />
        </CardContent>
      </Card>
    </Link>
  );
}

/* ─── REUSABLE CONTENT COMPONENTS ─── */

function ContentBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2.5">
        <span className="w-1.5 h-7 bg-gradient-to-b from-indigo-400 to-purple-400 rounded-full" />
        {title}
      </h2>
      <div className="text-indigo-100/90 leading-relaxed space-y-4">{children}</div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color = 'from-indigo-500 to-purple-500' }: { icon: React.ElementType; title: string; description: string; color?: string }) {
  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group">
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br shrink-0 shadow-md group-hover:scale-110 transition-transform duration-200", color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
          <p className="text-indigo-200/80 text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ExampleBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-400/25 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-purple-400" />
      <div className="flex items-start gap-3 pl-2">
        <Lightbulb className="h-5 w-5 text-indigo-300 shrink-0 mt-0.5" />
        <div className="text-sm text-indigo-200/90 leading-relaxed italic">{children}</div>
      </div>
    </div>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-400/25">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/20 shrink-0">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="text-sm text-emerald-100/90 leading-relaxed"><strong className="text-emerald-300">Consejo:</strong> {children}</div>
      </div>
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-400/25">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/20 shrink-0">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
        </div>
        <div className="text-sm text-amber-100/90 leading-relaxed"><strong className="text-amber-300">Importante:</strong> {children}</div>
      </div>
    </div>
  );
}

function StepList({ steps }: { steps: { title: string; description: string }[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0">
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className="w-0.5 flex-1 bg-gradient-to-b from-indigo-500/50 to-transparent my-1" />}
          </div>
          <div className={cn("pb-6 min-w-0", i === steps.length - 1 && "pb-0")}>
            <h4 className="font-semibold text-white text-sm mb-1">{step.title}</h4>
            <p className="text-indigo-200/80 text-sm leading-relaxed">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoGrid({ items }: { items: { icon: React.ElementType; label: string; value: string; color: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item, i) => {
        const ItemIcon = item.icon;
        return (
          <div key={i} className={cn("p-3 rounded-xl border text-center", item.color)}>
            <ItemIcon className="h-6 w-6 mx-auto mb-1.5" />
            <div className="font-bold text-sm">{item.value}</div>
            <div className="text-[11px] opacity-80 mt-0.5">{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── PREV / NEXT NAV ─── */
function SectionNav({ currentSlug, sections }: { currentSlug: string; sections: GuideSection[] }) {
  const { t, i18n } = useTranslation('landing');
  const idx = sections.findIndex((s) => s.slug === currentSlug);
  const prev = idx > 0 ? sections[idx - 1] : null;
  const next = idx < sections.length - 1 ? sections[idx + 1] : null;
  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-10 mb-2">
      {prev ? (
        <Link to={localizedPathFromEs(`/guia/${prev.slug}`, i18n.language)} className="flex-1">
          <div className="p-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30 hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 group flex items-center gap-3">
            <ChevronLeft className="h-5 w-5 text-white/50 group-hover:text-white group-hover:-translate-x-0.5 transition-all duration-200 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-indigo-300/70 uppercase font-semibold tracking-wider">{t('guide.prev')}</div>
              <div className="text-sm font-bold text-white truncate">{prev.title}</div>
            </div>
          </div>
        </Link>
      ) : <div className="flex-1" />}
      {next ? (
        <Link to={localizedPathFromEs(`/guia/${next.slug}`, i18n.language)} className="flex-1">
          <div className="p-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30 hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 group flex items-center gap-3 justify-end text-right">
            <div className="min-w-0">
              <div className="text-[11px] text-indigo-300/70 uppercase font-semibold tracking-wider">{t('guide.next')}</div>
              <div className="text-sm font-bold text-white truncate">{next.title}</div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
          </div>
        </Link>
      ) : <div className="flex-1" />}
    </div>
  );
}

/* ─── SECTION CONTENT RENDERERS ─── */

function PlanificadorContent() {
  const { t } = useTranslation('landing');
  return (
    <>
      <ContentBlock title={t('landing:guide.content.planificador.intro.title')}>
        <p>
          {t('landing:guide.content.planificador.intro.bodyBefore')}
          <strong className="text-white">{t('landing:guide.content.planificador.intro.bodyStrong')}</strong>
          {t('landing:guide.content.planificador.intro.bodyAfter')}
        </p>
        <ExampleBox>{t('landing:guide.content.planificador.intro.example')}</ExampleBox>
      </ContentBlock>

      <ContentBlock title={t('landing:guide.content.planificador.views.title')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <FeatureCard
            icon={Calendar}
            title={t('landing:guide.content.planificador.views.weekly.title')}
            description={t('landing:guide.content.planificador.views.weekly.description')}
            color="from-indigo-500 to-blue-500"
          />
          <FeatureCard
            icon={Layers}
            title={t('landing:guide.content.planificador.views.monthly.title')}
            description={t('landing:guide.content.planificador.views.monthly.description')}
            color="from-purple-500 to-pink-500"
          />
          <FeatureCard
            icon={LayoutGrid}
            title={t('landing:guide.content.planificador.views.mobile.title')}
            description={t('landing:guide.content.planificador.views.mobile.description')}
            color="from-emerald-500 to-teal-500"
          />
          <FeatureCard
            icon={Eye}
            title={t('landing:guide.content.planificador.views.projectPanel.title')}
            description={t('landing:guide.content.planificador.views.projectPanel.description')}
            color="from-amber-500 to-orange-500"
          />
        </div>
      </ContentBlock>

      <ContentBlock title={t('landing:guide.content.planificador.addTask.title')}>
        <StepList
          steps={[
            {
              title: t('landing:guide.content.planificador.addTask.step1Title'),
              description: t('landing:guide.content.planificador.addTask.step1Description'),
            },
            {
              title: t('landing:guide.content.planificador.addTask.step2Title'),
              description: t('landing:guide.content.planificador.addTask.step2Description'),
            },
            {
              title: t('landing:guide.content.planificador.addTask.step3Title'),
              description: t('landing:guide.content.planificador.addTask.step3Description'),
            },
            {
              title: t('landing:guide.content.planificador.addTask.step4Title'),
              description: t('landing:guide.content.planificador.addTask.step4Description'),
            },
            {
              title: t('landing:guide.content.planificador.addTask.step5Title'),
              description: t('landing:guide.content.planificador.addTask.step5Description'),
            },
          ]}
        />
      </ContentBlock>

      <ContentBlock title={t('landing:guide.content.planificador.indicators.title')}>
        <InfoGrid
          items={[
            {
              icon: CheckCircle2,
              label: t('landing:guide.content.planificador.indicators.healthyLabel'),
              value: t('landing:guide.content.planificador.indicators.healthyValue'),
              color: 'bg-emerald-500/15 border-emerald-400/25 text-emerald-300',
            },
            {
              icon: AlertTriangle,
              label: t('landing:guide.content.planificador.indicators.warningLabel'),
              value: t('landing:guide.content.planificador.indicators.warningValue'),
              color: 'bg-amber-500/15 border-amber-400/25 text-amber-300',
            },
            {
              icon: AlertTriangle,
              label: t('landing:guide.content.planificador.indicators.overloadLabel'),
              value: t('landing:guide.content.planificador.indicators.overloadValue'),
              color: 'bg-red-500/15 border-red-400/25 text-red-300',
            },
            {
              icon: Gauge,
              label: t('landing:guide.content.planificador.indicators.gaugeLabel'),
              value: t('landing:guide.content.planificador.indicators.gaugeValue'),
              color: 'bg-blue-500/15 border-blue-400/25 text-blue-300',
            },
          ]}
        />
        <div className="mt-3" />
        <TipBox>{t('landing:guide.content.planificador.indicators.tip')}</TipBox>
      </ContentBlock>

      <ContentBlock title={t('landing:guide.content.planificador.dependencies.title')}>
        <p>
          {t('landing:guide.content.planificador.dependencies.bodyBefore')}
          <strong className="text-white">{t('landing:guide.content.planificador.dependencies.bodyStrong')}</strong>
          {t('landing:guide.content.planificador.dependencies.bodyAfter')}
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <FeatureCard
            icon={GitBranch}
            title={t('landing:guide.content.planificador.dependencies.whoBlocksYouTitle')}
            description={t('landing:guide.content.planificador.dependencies.whoBlocksYouDescription')}
            color="from-amber-500 to-orange-500"
          />
          <FeatureCard
            icon={Bell}
            title={t('landing:guide.content.planificador.dependencies.whomYouBlockTitle')}
            description={t('landing:guide.content.planificador.dependencies.whomYouBlockDescription')}
            color="from-rose-500 to-red-500"
          />
        </div>
        <div className="mt-3" />
        <WarningBox>{t('landing:guide.content.planificador.dependencies.warning')}</WarningBox>
      </ContentBlock>
    </>
  );
}

function MiEspacioContent() {
  const { t } = useTranslation('landing');
  return (
    <>
      <ContentBlock title={t('guide.content.miEspacio.introTitle')}>
        <p>
          {t('guide.content.miEspacio.introBody.beforeHighlight')}{' '}
          <strong className="text-white">{t('guide.content.miEspacio.introBody.highlight')}</strong>
          {t('guide.content.miEspacio.introBody.afterHighlight')}
        </p>
        <ExampleBox>{t('guide.content.miEspacio.introExample')}</ExampleBox>
      </ContentBlock>

      <ContentBlock title={t('guide.content.miEspacio.tabsTitle')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <FeatureCard
            icon={AlertTriangle}
            title={t('guide.content.miEspacio.tabs.dependencies.title')}
            description={t('guide.content.miEspacio.tabs.dependencies.description')}
            color="from-orange-500 to-amber-500"
          />
          <FeatureCard
            icon={FolderOpen}
            title={t('guide.content.miEspacio.tabs.projects.title')}
            description={t('guide.content.miEspacio.tabs.projects.description')}
            color="from-indigo-500 to-blue-500"
          />
          <FeatureCard
            icon={Target}
            title={t('guide.content.miEspacio.tabs.planning.title')}
            description={t('guide.content.miEspacio.tabs.planning.description')}
            color="from-red-500 to-rose-500"
          />
          <FeatureCard
            icon={Users}
            title={t('guide.content.miEspacio.tabs.teammates.title')}
            description={t('guide.content.miEspacio.tabs.teammates.description')}
            color="from-blue-500 to-cyan-500"
          />
          <FeatureCard
            icon={TrendingUp}
            title={t('guide.content.miEspacio.tabs.metrics.title')}
            description={t('guide.content.miEspacio.tabs.metrics.description')}
            color="from-emerald-500 to-teal-500"
          />
        </div>
      </ContentBlock>

      <ContentBlock title={t('guide.content.miEspacio.planningDetailTitle')}>
        <p>
          {t('guide.content.miEspacio.planningDetailBody.beforeHighlight')}{' '}
          <strong className="text-white">{t('guide.content.miEspacio.planningDetailBody.highlight')}</strong>{' '}
          {t('guide.content.miEspacio.planningDetailBody.afterHighlight')}
        </p>
        <StepList steps={[
          {
            title: t('guide.content.miEspacio.planningDetailSteps.projectTitle'),
            description: t('guide.content.miEspacio.planningDetailSteps.projectDescription'),
          },
          {
            title: t('guide.content.miEspacio.planningDetailSteps.yourDataTitle'),
            description: t('guide.content.miEspacio.planningDetailSteps.yourDataDescription'),
          },
          {
            title: t('guide.content.miEspacio.planningDetailSteps.teamTitle'),
            description: t('guide.content.miEspacio.planningDetailSteps.teamDescription'),
          },
        ]} />
        <div className="mt-3" />
        <WarningBox>{t('guide.content.miEspacio.planningDetailWarning')}</WarningBox>
      </ContentBlock>

      <ContentBlock title={t('guide.content.miEspacio.quickActionsTitle')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <FeatureCard
            icon={Clock}
            title={t('guide.content.miEspacio.quickActions.internalTitle')}
            description={t('guide.content.miEspacio.quickActions.internalDescription')}
            color="from-slate-500 to-slate-700"
          />
          <FeatureCard
            icon={Plus}
            title={t('guide.content.miEspacio.quickActions.addTasksTitle')}
            description={t('guide.content.miEspacio.quickActions.addTasksDescription')}
            color="from-indigo-500 to-purple-500"
          />
        </div>
        <div className="mt-3" />
        <TipBox>{t('guide.content.miEspacio.quickActionsTip')}</TipBox>
      </ContentBlock>
    </>
  );
}

function DeadlinesContent() {
  const { t } = useTranslation('landing');
  return (
    <>
      <ContentBlock title={t('guide.content.deadlines.introTitle')}>
        <p>{t('guide.content.deadlines.introBody')}</p>
        <ExampleBox>{t('guide.content.deadlines.introExample')}</ExampleBox>
      </ContentBlock>

      <ContentBlock title={t('guide.content.deadlines.featuresTitle')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <FeatureCard
            icon={Users}
            title={t('guide.content.deadlines.featuresAssignHoursTitle')}
            description={t('guide.content.deadlines.featuresAssignHoursDesc')}
            color="from-indigo-500 to-blue-500"
          />
          <FeatureCard
            icon={DollarSign}
            title={t('guide.content.deadlines.featuresAdjustBudgetTitle')}
            description={t('guide.content.deadlines.featuresAdjustBudgetDesc')}
            color="from-amber-500 to-orange-500"
          />
          <FeatureCard
            icon={Filter}
            title={t('guide.content.deadlines.featuresFiltersTitle')}
            description={t('guide.content.deadlines.featuresFiltersDesc')}
            color="from-slate-500 to-indigo-500"
          />
          <FeatureCard
            icon={Pencil}
            title={t('guide.content.deadlines.featuresQuickEditTitle')}
            description={t('guide.content.deadlines.featuresQuickEditDesc')}
            color="from-purple-500 to-pink-500"
          />
        </div>
      </ContentBlock>

      <ContentBlock title={t('guide.content.deadlines.relationTitle')}>
        <p>{t('guide.content.deadlines.relationBody')}</p>
        <WarningBox>{t('guide.content.deadlines.relationWarning')}</WarningBox>
        <div className="mt-3" />
        <TipBox>{t('guide.content.deadlines.relationTip')}</TipBox>
      </ContentBlock>
    </>
  );
}

function InformesContent() {
  const { t } = useTranslation('landing');

  return (
    <>
      <ContentBlock title={t('guide.content.informes.introTitle')}>
        <p>{t('guide.content.informes.introBody')}</p>
      </ContentBlock>

      <ContentBlock title={t('guide.content.informes.sectionsTitle')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <FeatureCard
            icon={Activity}
            title={t('guide.content.informes.operationalTitle')}
            description={t('guide.content.informes.operationalDesc')}
            color="from-indigo-500 to-blue-500"
          />
          <FeatureCard
            icon={BarChart3}
            title={t('guide.content.informes.profitTitle')}
            description={t('guide.content.informes.profitDesc')}
            color="from-emerald-500 to-teal-500"
          />
          <FeatureCard
            icon={BarChart3}
            title={t('guide.content.informes.capacityTitle')}
            description={t('guide.content.informes.capacityDesc')}
            color="from-blue-500 to-cyan-500"
          />
          <FeatureCard
            icon={Download}
            title={t('guide.content.informes.exportTitle')}
            description={t('guide.content.informes.exportDesc')}
            color="from-emerald-500 to-teal-500"
          />
          <FeatureCard
            icon={Filter}
            title={t('guide.content.informes.filtersTitle')}
            description={t('guide.content.informes.filtersDesc')}
            color="from-purple-500 to-pink-500"
          />
        </div>
      </ContentBlock>
    </>
  );
}

function WeeklyContent() {
  const { t } = useTranslation('landing');
  const howSteps = i18nAsArray<{ title: string; description: string }>(
    t('guide.content.weeklyForecast.howSteps', { returnObjects: true }),
  );

  return (
    <>
      <ContentBlock title={t('guide.content.weeklyForecast.introTitle')}>
        <p>{t('guide.content.weeklyForecast.introBody')}</p>
        <ExampleBox>{t('guide.content.weeklyForecast.introExample')}</ExampleBox>
      </ContentBlock>

      <ContentBlock title={t('guide.content.weeklyForecast.accessTitle')}>
        <p>{t('guide.content.weeklyForecast.accessBody')}</p>
      </ContentBlock>

      <ContentBlock title={t('guide.content.weeklyForecast.howTitle')}>
        <StepList steps={howSteps} />
      </ContentBlock>

      <ContentBlock title={t('guide.content.weeklyForecast.integrationTitle')}>
        <p>{t('guide.content.weeklyForecast.integrationBody')}</p>
        <WarningBox>{t('guide.content.weeklyForecast.integrationWarning')}</WarningBox>
      </ContentBlock>
    </>
  );
}

function EquipoContent() {
  const { t } = useTranslation();
  return (
    <>
      <ContentBlock title={t('landing:guide.content.equipo.introTitle')}>
        <p>{t('landing:guide.content.equipo.introBody')}</p>
      </ContentBlock>

      <ContentBlock title={t('landing:guide.content.equipo.featuresTitle')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <FeatureCard icon={Users} title={t('landing:guide.content.equipo.listTitle')} description={t('landing:guide.content.equipo.listDesc')} color="from-blue-500 to-cyan-500" />
          <FeatureCard icon={Clock} title={t('landing:guide.content.equipo.schedulesTitle')} description={t('landing:guide.content.equipo.schedulesDesc')} color="from-indigo-500 to-blue-500" />
          <FeatureCard icon={CalendarOff} title={t('landing:guide.content.equipo.absencesTitle')} description={t('landing:guide.content.equipo.absencesDesc')} color="from-amber-500 to-orange-500" />
          <FeatureCard icon={Gauge} title={t('landing:guide.content.equipo.capacityTitle')} description={t('landing:guide.content.equipo.capacityDesc')} color="from-emerald-500 to-teal-500" />
        </div>
      </ContentBlock>

      <ContentBlock title={t('landing:guide.content.equipo.createTitle')}>
        <StepList steps={[
          { title: t('landing:guide.content.equipo.createStep1Title'), description: t('landing:guide.content.equipo.createStep1Desc') },
          { title: t('landing:guide.content.equipo.createStep2Title'), description: t('landing:guide.content.equipo.createStep2Desc') },
          { title: t('landing:guide.content.equipo.createStep3Title'), description: t('landing:guide.content.equipo.createStep3Desc') },
        ]} />
        <div className="mt-3" />
        <TipBox>{t('landing:guide.content.equipo.tip')}</TipBox>
      </ContentBlock>
    </>
  );
}

function TiemposContent() {
  const { t } = useTranslation('landing');
  return (
    <>
      <ContentBlock title={t('guide.content.tiempos.introTitle')}>
        <p>{t('guide.content.tiempos.introBody')}</p>
        <ExampleBox>{t('guide.content.tiempos.introExample')}</ExampleBox>
      </ContentBlock>

      <ContentBlock title={t('guide.content.tiempos.whereTitle')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <FeatureCard
            icon={Calendar}
            title={t('guide.content.tiempos.wherePlannerTitle')}
            description={t('guide.content.tiempos.wherePlannerDescription')}
            color="from-indigo-500 to-purple-500"
          />
          <FeatureCard
            icon={LayoutGrid}
            title={t('guide.content.tiempos.whereMyDayTitle')}
            description={t('guide.content.tiempos.whereMyDayDescription')}
            color="from-purple-500 to-pink-500"
          />
          <FeatureCard
            icon={Clock}
            title={t('guide.content.tiempos.whereSidebarTitle')}
            description={t('guide.content.tiempos.whereSidebarDescription')}
            color="from-teal-500 to-emerald-500"
          />
          <FeatureCard
            icon={Users}
            title={t('guide.content.tiempos.whereTimesPageTitle')}
            description={t('guide.content.tiempos.whereTimesPageDescription')}
            color="from-blue-500 to-cyan-500"
          />
        </div>
        <div className="mt-3" />
        <TipBox>{t('guide.content.tiempos.whereTip')}</TipBox>
      </ContentBlock>

      <ContentBlock title={t('guide.content.tiempos.howTitle')}>
        <StepList steps={[
          {
            title: t('guide.content.tiempos.howStartTitle'),
            description: t('guide.content.tiempos.howStartDescription'),
          },
          {
            title: t('guide.content.tiempos.howStopTitle'),
            description: t('guide.content.tiempos.howStopDescription'),
          },
          {
            title: t('guide.content.tiempos.howChangeTitle'),
            description: t('guide.content.tiempos.howChangeDescription'),
          },
          {
            title: t('guide.content.tiempos.howTotalTitle'),
            description: t('guide.content.tiempos.howTotalDescription'),
          },
        ]} />
      </ContentBlock>
    </>
  );
}

function ClientesContent() {
  const { t } = useTranslation('landing');
  return (
    <>
      <ContentBlock title={t('guide.content.clientesProyectos.introTitle')}>
        <p>{t('guide.content.clientesProyectos.introBody')}</p>
        <ExampleBox>{t('guide.content.clientesProyectos.introExample')}</ExampleBox>
      </ContentBlock>

      <ContentBlock title={t('guide.content.clientesProyectos.featuresTitle')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <FeatureCard
            icon={Building2}
            title={t('guide.content.clientesProyectos.featuresClientsTitle')}
            description={t('guide.content.clientesProyectos.featuresClientsDesc')}
            color="from-slate-500 to-indigo-500"
          />
          <FeatureCard
            icon={FolderOpen}
            title={t('guide.content.clientesProyectos.featuresProjectsTitle')}
            description={t('guide.content.clientesProyectos.featuresProjectsDesc')}
            color="from-indigo-500 to-purple-500"
          />
          <FeatureCard
            icon={Tag}
            title={t('guide.content.clientesProyectos.featuresAliasesTitle')}
            description={t('guide.content.clientesProyectos.featuresAliasesDesc')}
            color="from-purple-500 to-pink-500"
          />
          <FeatureCard
            icon={ToggleLeft}
            title={t('guide.content.clientesProyectos.featuresStatusTitle')}
            description={t('guide.content.clientesProyectos.featuresStatusDesc')}
            color="from-amber-500 to-orange-500"
          />
        </div>
      </ContentBlock>

      <ContentBlock title={t('guide.content.clientesProyectos.relationTitle')}>
        <p>{t('guide.content.clientesProyectos.relationBody')}</p>
        <WarningBox>{t('guide.content.clientesProyectos.relationWarning')}</WarningBox>
      </ContentBlock>
    </>
  );
}

function ConfiguracionContent() {
  const { t, i18n } = useTranslation('landing');
  const apiDocsPath = localizedPathFromEs('/api-docs', i18n.language);
  return (
    <>
      <ContentBlock title={t('guide.content.configuracion.introTitle')}>
        <p>{t('guide.content.configuracion.introBody')}</p>
      </ContentBlock>

      <ContentBlock title={t('guide.content.configuracion.rolesTitle')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <FeatureCard
            icon={Shield}
            title={t('guide.content.configuracion.rolesFeatureRolesTitle')}
            description={t('guide.content.configuracion.rolesFeatureRolesDesc')}
            color="from-indigo-500 to-blue-500"
          />
          <FeatureCard
            icon={Settings}
            title={t('guide.content.configuracion.rolesFeaturePermsTitle')}
            description={t('guide.content.configuracion.rolesFeaturePermsDesc')}
            color="from-purple-500 to-pink-500"
          />
        </div>
        <div className="mt-3" />
        <ExampleBox>{t('guide.content.configuracion.rolesExample')}</ExampleBox>
      </ContentBlock>

      <ContentBlock title={t('guide.content.configuracion.modulesTitle')}>
        <p>{t('guide.content.configuracion.modulesIntro')}</p>
        <InfoGrid items={[
          {
            icon: Target,
            label: t('guide.content.configuracion.modulesDeadlinesLabel'),
            value: t('guide.content.configuracion.modulesDeadlinesValue'),
            color: 'bg-amber-500/15 border-amber-400/25 text-amber-300',
          },
          {
            icon: FileText,
            label: t('guide.content.configuracion.modulesWeeklyLabel'),
            value: t('guide.content.configuracion.modulesWeeklyValue'),
            color: 'bg-violet-500/15 border-violet-400/25 text-violet-300',
          },
          {
            icon: BarChart3,
            label: t('guide.content.configuracion.modulesPpcLabel'),
            value: t('guide.content.configuracion.modulesPpcValue'),
            color: 'bg-blue-500/15 border-blue-400/25 text-blue-300',
          },
        ]} />
        <div className="mt-3" />
        <TipBox>{t('guide.content.configuracion.modulesTip')}</TipBox>
      </ContentBlock>

      <ContentBlock title={t('guide.content.configuracion.agencyTitle')}>
        <p>{t('guide.content.configuracion.agencyBody')}</p>
      </ContentBlock>

      <ContentBlock title={t('guide.content.configuracion.apiTitle')}>
        <p>{t('guide.content.configuracion.apiBody')}</p>
        <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-sm text-indigo-200/90 mb-3">
            {t('guide.content.configuracion.apiDocsIntro')}{' '}
            <Link to="/api-docs" className="text-indigo-300 hover:text-white font-medium underline underline-offset-2">
              {t('guide.content.configuracion.apiDocsLinkText')}
            </Link>{' '}
            {t('guide.content.configuracion.apiDocsIntroSuffix')}
          </p>
          <ul className="text-sm text-indigo-200/80 space-y-1.5 list-disc list-inside">
            <li>{t('guide.content.configuracion.apiDocsItem1')}</li>
            <li>{t('guide.content.configuracion.apiDocsItem2')}</li>
            <li>{t('guide.content.configuracion.apiDocsItem3')}</li>
            <li>{t('guide.content.configuracion.apiDocsItem4')}</li>
            <li>{t('guide.content.configuracion.apiDocsItem5')}</li>
          </ul>
          <Link to={apiDocsPath}>
            <Button className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white border-0">
              {t('guide.content.configuracion.apiDocsButton')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </ContentBlock>
    </>
  );
}

/* ─── CONTENT MAP ─── */
const CONTENT_MAP: Record<string, React.FC> = {
  'planificador': PlanificadorContent,
  'mi-espacio': MiEspacioContent,
  'deadlines': DeadlinesContent,
  'informes': InformesContent,
  'weekly-forecast': WeeklyContent,
  'equipo': EquipoContent,
  'tiempos': TiemposContent,
  'clientes-proyectos': ClientesContent,
  'configuracion': ConfiguracionContent,
};

/* ─── MAIN PAGE ─── */
export default function GuiaPage() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('landing');
  const sections = useMemo(() => buildGuideSections(t), [t]);
  const lang = i18n.language.startsWith('en') ? 'en' : 'es';
  const guideIndexPath = localizedPathFromEs('/guia', i18n.language);
  const homePath = localizedPathFromEs('/', i18n.language);

  useEffect(() => {
    if (section) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [section]);

  useEffect(() => {
    if (section && !sections.some((s) => s.slug === section)) {
      navigate(guideIndexPath, { replace: true });
    }
  }, [section, sections, guideIndexPath, navigate]);

  if (!section) {
    return (
      <>
        <SeoTags
          pathEs="/guia"
          pathEn="/en/guide"
          title={t('guide.seoTitleIndex')}
          description={t('guide.seoDescriptionIndex')}
          lang={lang}
        />
      <GuiaLayout title={t('guide.layoutTitleIndex')} description={t('guide.layoutDescriptionIndex')}>
        <div className="space-y-6">
          {sections.map((s) => (
            <SectionCard key={s.slug} {...s} />
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link to={homePath}>
            <Button variant="outline" className="border-white/40 !bg-white/10 text-white hover:text-white hover:!bg-white/20 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200">
              <Home className="h-4 w-4 mr-2" /> {t('guide.backHome')}
            </Button>
          </Link>
        </div>
      </GuiaLayout>
      </>
    );
  }

  const current = sections.find((s) => s.slug === section);
  if (!current) {
    return null;
  }

  const Icon = current.icon;
  const SectionContent = CONTENT_MAP[section];
  const pathEsSection = `/guia/${section}`;

  return (
    <>
      <SeoTags
        pathEs={pathEsSection}
        pathEn={pathEsToEn(pathEsSection)}
        title={t('guide.sectionTitle', { section: current.title })}
        description={current.short}
        lang={lang}
      />
      <GuiaLayout>
        <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 hover:scale-105 mb-6 -ml-2 transition-all duration-200" onClick={() => navigate(guideIndexPath)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t('guide.backToIndex')}
        </Button>

        <Card className="border-2 border-white/20 bg-gradient-to-br from-indigo-900/90 to-purple-900/90 backdrop-blur-xl overflow-hidden mb-4">
          <CardContent className="p-6 sm:p-8">
            {/* Hero header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-xl", current.color)}>
                <Icon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">{current.title}</h1>
                <p className="text-indigo-200/80 mt-1">{current.short}</p>
              </div>
            </div>

            {SectionContent && <SectionContent />}
          </CardContent>
        </Card>

        {/* Prev / Next navigation */}
        <SectionNav currentSlug={section} sections={sections} />

        <div className="flex flex-wrap gap-3 justify-center mt-6">
          <Button variant="outline" className="border-white/40 !bg-white/10 text-white hover:text-white hover:!bg-white/20 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200" onClick={() => navigate(guideIndexPath)}>
            <BookOpen className="h-4 w-4 mr-2" /> {t('guide.guideIndex')}
          </Button>
          <Link to={homePath}>
            <Button variant="outline" className="border-white/40 !bg-white/10 text-white hover:text-white hover:!bg-white/20 hover:scale-105 hover:shadow-lg transition-all duration-200">
              <Home className="h-4 w-4 mr-2" /> {t('guide.home')}
            </Button>
          </Link>
        </div>
      </GuiaLayout>
    </>
  );
}
