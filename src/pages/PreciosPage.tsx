import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingPricingCurrencySelect } from '@/components/landing/LandingPricingCurrencySelect';
import { Button } from '@/components/ui/button';
import {
  Check,
  Zap,
  Building2,
  Sparkles,
  ArrowRight,
  Shield,
  RefreshCw,
  CreditCard,
  LayoutGrid,
  Users,
  PieChart,
  Activity,
  Lock,
  Rocket,
  Crown,
  Layers,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SeoTags } from '@/seo/SeoTags';
import { i18nAsArray } from '@/lib/i18nReturnObjects';
import { PUBLIC_PLAN_PRICING, PUBLIC_PLAN_LABELS, type PublicPlanId } from '@/config/publicPricing';
import { PRICING_ROW_PRIMARY, PRICING_ROW_SECONDARY } from '@/config/publicPricingLayout';
import { usePublicPricingCurrency } from '@/hooks/usePublicPricingCurrency';
import { useHomeLiteralT } from '@/components/landing/below/useHomeLiteralT';

const PLAN_UI: Record<
  PublicPlanId,
  {
    name: string;
    icon: LucideIcon;
    iconBg: string;
    iconColor: string;
    cardStyle: string;
  }
> = {
  starter: {
    name: PUBLIC_PLAN_LABELS.starter,
    icon: Zap,
    iconBg: 'bg-indigo-500/20 border border-indigo-500/30',
    iconColor: 'text-indigo-400',
    cardStyle: 'bg-slate-900/80 border-white/10 hover:border-indigo-500/30 transition-all duration-300',
  },
  pro: {
    name: PUBLIC_PLAN_LABELS.pro,
    icon: Sparkles,
    iconBg: 'bg-purple-500/20 border border-purple-500/30',
    iconColor: 'text-purple-400',
    cardStyle: 'bg-slate-900/80 border-white/10 hover:border-purple-500/30 transition-all duration-300',
  },
  business: {
    name: PUBLIC_PLAN_LABELS.business,
    icon: Building2,
    iconBg: 'bg-amber-500/20 border border-amber-500/30',
    iconColor: 'text-amber-400',
    cardStyle:
      'bg-gradient-to-b from-indigo-500/10 to-purple-500/10 border-indigo-500/40 relative lg:-translate-y-2 shadow-2xl shadow-purple-500/20 transition-all duration-300',
  },
  scale: {
    name: PUBLIC_PLAN_LABELS.scale,
    icon: Layers,
    iconBg: 'bg-cyan-500/20 border border-cyan-500/30',
    iconColor: 'text-cyan-400',
    cardStyle: 'bg-slate-900/80 border-white/10 hover:border-cyan-500/30 transition-all duration-300',
  },
  enterprise: {
    name: PUBLIC_PLAN_LABELS.enterprise,
    icon: Crown,
    iconBg: 'bg-slate-500/20 border border-white/20',
    iconColor: 'text-slate-200',
    cardStyle: 'bg-slate-900/80 border-white/10 hover:border-white/25 transition-all duration-300',
  },
};

const UNIVERSAL_ICONS = [LayoutGrid, Users, PieChart, Activity, Lock, Shield];
const TRUST_ICONS = [RefreshCw, Shield, CreditCard];

export default function PreciosPage() {
  const { t, i18n } = useTranslation('landing');
  const { path } = useHomeLiteralT();
  const lang = i18n.language.startsWith('en') ? 'en' : 'es';

  const {
    currency,
    setCurrency,
    currencyOptions,
    ratesLoading,
    formatMonthly,
    formatUsdAmount,
    billingNote,
  } = usePublicPricingCurrency();

  type PlanCard = (typeof PUBLIC_PLAN_PRICING)[number] & (typeof PLAN_UI)[PublicPlanId] & {
    period: string;
    description: string;
    features: string[];
    cta: string;
    customPrice: string;
  };

  const plansById = useMemo(() => {
    const map = {} as Record<PublicPlanId, PlanCard>;
    for (const meta of PUBLIC_PLAN_PRICING) {
      map[meta.id] = {
        ...meta,
        ...PLAN_UI[meta.id],
        period: t(`pricing.plans.${meta.id}.period`),
        description: t(`pricing.plans.${meta.id}.description`),
        features: i18nAsArray<string>(t(`pricing.plans.${meta.id}.features`, { returnObjects: true })),
        cta: t(`pricing.plans.${meta.id}.cta`),
        customPrice: t(`pricing.plans.${meta.id}.customPrice`, { defaultValue: '' }),
      };
    }
    return map;
  }, [t]);

  const universalItems = i18nAsArray<{ title: string; desc: string }>(
    t('pricing.universal', { returnObjects: true }),
  );
  const trustLines = i18nAsArray<{ text: string; sub: string }>(t('pricing.trust', { returnObjects: true }));
  const faqItems = i18nAsArray<{ q: string; a: string }>(t('pricing.faq', { returnObjects: true }));
  const heroPills = [t('pricing.pill1'), t('pricing.pill2'), t('pricing.pill3')];

  const enterpriseMail = `mailto:hello@taimbox.com?subject=${encodeURIComponent(t('pricing.enterpriseMailSubject'))}`;

  return (
    <>
      <SeoTags
        pathEs="/precios"
        pathEn="/en/pricing"
        title={t('pricing.seoTitle')}
        description={t('pricing.seoDescription')}
        lang={lang}
      />

      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-50" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl opacity-30 pointer-events-none" />
        </div>
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />

        <LandingHeader />

        <article className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14 md:py-16 text-left overflow-x-hidden">

          <section className="mb-12 sm:mb-16 text-center">
            <div className="mb-6">
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 border border-indigo-400/30">
                {t('pricing.heroKicker')}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-[1.1] tracking-tight">
              {t('pricing.heroLine1')}{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {t('pricing.heroHighlight')}
              </span>
            </h1>

            <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs font-semibold uppercase tracking-wider">
              <Rocket className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              {t('pricing.earlyAdopter')}
            </div>

            <p className="text-indigo-100/90 text-base sm:text-lg lg:text-xl leading-relaxed max-w-3xl mx-auto mb-8">
              {t('pricing.heroSub')}
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              {heroPills.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-indigo-200/90 text-xs font-medium">
                  <Check className="h-3 w-3 text-emerald-400" />
                  {f}
                </span>
              ))}
            </div>
          </section>

          <section className="mb-16 sm:mb-24">
            <LandingPricingCurrencySelect
              currency={currency}
              onCurrencyChange={setCurrency}
              options={currencyOptions}
              loading={ratesLoading}
              variant="dark"
            />
            <p className="text-center text-[11px] text-indigo-300/70 max-w-lg mx-auto -mt-4 mb-10">{billingNote}</p>

            <div className="space-y-8 lg:space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                {PRICING_ROW_PRIMARY.map((planId) => {
                  const plan = plansById[planId];
                  const Icon = plan.icon;
                  const isEnterprise = plan.usdMonthly == null;
                  const isContactSales = isEnterprise || plan.id === 'scale';
                  const hasEarlyDiscount = plan.usdMonthlyOfficial != null && plan.usdMonthly != null;
                  const registerHref = path(plan.href);

                  return (
                    <div
                      key={plan.id}
                      className={`rounded-2xl border p-6 sm:p-8 backdrop-blur-md flex flex-col relative min-h-[420px] ${plan.cardStyle}`}
                    >
                      {plan.recommended && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg shadow-purple-500/30">
                            {t('pricing.recommended')}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mb-4">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${plan.iconBg}`}>
                          <Icon className={`h-5 w-5 ${plan.iconColor}`} />
                        </div>
                        <span className="text-white font-bold text-lg">{plan.name}</span>
                      </div>

                      <p className="text-indigo-200/80 text-sm mb-5 leading-relaxed">{plan.description}</p>

                      <div className="flex flex-col mb-5 pb-5 border-b border-white/10">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          {hasEarlyDiscount && (
                            <span className="text-sm font-medium text-indigo-300/40 line-through tabular-nums">
                              {formatMonthly(plan.usdMonthlyOfficial!)}
                            </span>
                          )}
                          <span className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">
                            {isEnterprise
                              ? plan.customPrice
                              : plan.usdMonthly === 0
                                ? formatUsdAmount(0)
                                : formatMonthly(plan.usdMonthly!)}
                          </span>
                          {!isEnterprise && plan.period ? (
                            <span className="text-sm font-medium text-indigo-300/80">/ {plan.period}</span>
                          ) : null}
                        </div>
                        {hasEarlyDiscount && (
                          <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 uppercase tracking-wide">
                            <Sparkles className="h-3 w-3 text-amber-400 shrink-0" aria-hidden />
                            {t('pricing.earlyTariff')}
                          </span>
                        )}
                      </div>

                      <ul className="space-y-3 flex-1 mb-6 text-[13px] sm:text-sm">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                            <span className={i === 0 && plan.id !== 'starter' ? 'text-white font-semibold' : 'text-indigo-100/90'}>
                              {f}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {isContactSales ? (
                        plan.id === 'enterprise' ? (
                          <a href={enterpriseMail} className="mt-auto block">
                            <Button size="lg" className="w-full text-sm font-bold h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20">
                              {plan.cta}
                            </Button>
                          </a>
                        ) : (
                          <Link to="/contacto" className="mt-auto block">
                            <Button size="lg" className="w-full text-sm font-bold h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20">
                              {plan.cta}
                            </Button>
                          </Link>
                        )
                      ) : (
                        <Link to={registerHref} className="mt-auto block">
                          <Button
                            size="lg"
                            className={`w-full text-sm font-bold h-12 rounded-xl ${plan.recommended
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25'
                              : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                              }`}
                          >
                            {plan.cta}
                            {plan.recommended && <ArrowRight className="ml-2 h-4 w-4" />}
                          </Button>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 max-w-3xl mx-auto">
                {PRICING_ROW_SECONDARY.map((planId) => {
                  const plan = plansById[planId];
                  const Icon = plan.icon;
                  const isEnterprise = plan.usdMonthly == null;
                  const isContactSales = isEnterprise || plan.id === 'scale';
                  const hasEarlyDiscount = plan.usdMonthlyOfficial != null && plan.usdMonthly != null;
                  const registerHref = path(plan.href);

                  return (
                    <div
                      key={plan.id}
                      className={`rounded-2xl border p-6 sm:p-8 backdrop-blur-md flex flex-col relative min-h-[380px] ${plan.cardStyle}`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${plan.iconBg}`}>
                          <Icon className={`h-5 w-5 ${plan.iconColor}`} />
                        </div>
                        <span className="text-white font-bold text-lg">{plan.name}</span>
                      </div>

                      <p className="text-indigo-200/80 text-sm mb-5 leading-relaxed">{plan.description}</p>

                      <div className="flex flex-col mb-5 pb-5 border-b border-white/10">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">
                            {isEnterprise ? plan.customPrice : formatMonthly(plan.usdMonthly!)}
                          </span>
                          {!isEnterprise && plan.period ? (
                            <span className="text-sm font-medium text-indigo-300/80">/ {plan.period}</span>
                          ) : null}
                        </div>
                      </div>

                      <ul className="space-y-3 flex-1 mb-6 text-[13px] sm:text-sm">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                            <span className={i === 0 ? 'text-white font-semibold' : 'text-indigo-100/90'}>{f}</span>
                          </li>
                        ))}
                      </ul>

                      {isContactSales ? (
                        plan.id === 'enterprise' ? (
                          <a href={enterpriseMail} className="mt-auto block">
                            <Button size="lg" className="w-full text-sm font-bold h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20">
                              {plan.cta}
                            </Button>
                          </a>
                        ) : (
                          <Link to="/contacto" className="mt-auto block">
                            <Button size="lg" className="w-full text-sm font-bold h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20">
                              {plan.cta}
                            </Button>
                          </Link>
                        )
                      ) : (
                        <Link to={registerHref} className="mt-auto block">
                          <Button size="lg" className="w-full text-sm font-bold h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20">
                            {plan.cta}
                          </Button>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-12 flex flex-wrap justify-center gap-6 sm:gap-10">
              {trustLines.map((item, i) => {
                const Icon = TRUST_ICONS[i] ?? Shield;
                return (
                  <div key={item.text} className="flex items-center gap-3 text-indigo-100/90">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.text}</p>
                      <p className="text-xs text-indigo-200/70">{item.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 p-5 sm:p-6 text-center">
              <p className="text-amber-100/90 text-sm sm:text-base leading-relaxed">
                {t('pricing.rewardBanner')}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="text-white font-semibold text-sm">{t('pricing.enterpriseTitle')}</p>
                <p className="text-indigo-200/70 text-xs mt-0.5">{t('pricing.enterpriseSub')}</p>
              </div>
              <a
                href={enterpriseMail}
                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold transition-colors"
              >
                {t('pricing.enterpriseCta')}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </section>

          <section className="mb-20 sm:mb-24">
            <div className="text-center mb-10">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/90 mb-3 block">
                {t('pricing.includedTitle')}
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                {t('pricing.includedH2')}
              </h2>
              <p className="text-indigo-100/80 text-sm sm:text-base max-w-2xl mx-auto">
                {t('pricing.includedSub')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {universalItems.map((item, i) => {
                const Icon = UNIVERSAL_ICONS[i] ?? LayoutGrid;
                return (
                  <div key={i} className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm p-6 hover:bg-slate-800/60 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-indigo-400" />
                    </div>
                    <h3 className="text-base text-white font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-indigo-200/70 leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mb-20 sm:mb-24">
            <div className="text-center mb-10">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-300/90 mb-3 block">
                {t('pricing.faqKicker')}
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {t('pricing.faqH2')}
              </h2>
            </div>
            <div className="max-w-3xl mx-auto space-y-3">
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="rounded-2xl border border-white/10 bg-slate-900/60 px-5 sm:px-6 data-[state=open]:bg-slate-800/80 transition-colors mb-3 last:mb-0"
                  >
                    <AccordionTrigger className="text-left text-white font-semibold hover:text-indigo-200 hover:no-underline py-5 text-sm sm:text-base">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-indigo-200/90 text-sm sm:text-base pb-5 leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          <section className="mb-0">
            <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-indigo-500/10 p-8 sm:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 -m-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 -m-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />

              <div className="relative z-10">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-4 text-center">
                  {t('pricing.finalH2')}
                </h2>
                <p className="text-indigo-100/90 mb-8 text-base sm:text-lg leading-relaxed text-center max-w-2xl mx-auto">
                  {t('pricing.finalSub')}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
                  {[
                    { num: formatUsdAmount(0), label: t('pricing.finalStat1Label') },
                    { num: '14', label: t('pricing.finalStat2Label') },
                    { num: '1 min', label: t('pricing.finalStat3Label') },
                  ].map(({ num, label }, i) => (
                    <div key={i} className="text-center p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-sm">
                      <p className="text-2xl sm:text-3xl font-black text-white">{num}</p>
                      <p className="text-xs text-indigo-300/80 mt-1 font-medium">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="text-center">
                  <Link to="/login?tab=register">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-12 py-7 text-lg font-bold shadow-2xl shadow-indigo-500/30 rounded-xl"
                    >
                      {t('pricing.finalCta')}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <p className="mt-4 text-sm text-indigo-200/80">
                    {t('pricing.finalLogin')}{' '}
                    <Link to="/login" className="text-white font-semibold hover:text-indigo-300 transition-colors">
                      {t('pricing.finalLoginLink')}
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </section>

        </article>

        <LandingFooter />
      </div>
    </>
  );
}
