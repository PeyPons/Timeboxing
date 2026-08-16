import { useMemo, type FC } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Crown,
  Rocket,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { landingInlineStyle } from "@/components/landing/below/landingInlineStyle";
import { useHomeLiteralT } from "@/components/landing/below/useHomeLiteralT";
import { LandingPricingCurrencySelect } from "@/components/landing/LandingPricingCurrencySelect";
import { PUBLIC_PLAN_PRICING, PUBLIC_PLAN_LABELS, type PublicPlanId } from "@/config/publicPricing";
import { PRICING_HOME_PLAN_IDS } from "@/config/publicPricingLayout";
import { usePublicPricingCurrency } from "@/hooks/usePublicPricingCurrency";
import { i18nAsArray } from "@/lib/i18nReturnObjects";

const PLAN_ICONS: Partial<Record<PublicPlanId, { icon: LucideIcon; bg: string; color: string }>> = {
  starter: {
    icon: Users,
    bg: "rgba(100, 116, 139, 0.08)",
    color: "rgb(100, 116, 139)",
  },
  pro: {
    icon: Zap,
    bg: "rgba(99, 102, 241, 0.1)",
    color: "rgb(79, 70, 229)",
  },
  business: {
    icon: Crown,
    bg: "rgba(236, 72, 153, 0.08)",
    color: "rgb(236, 72, 153)",
  },
  enterprise: {
    icon: Building2,
    bg: "rgba(15, 23, 42, 0.08)",
    color: "rgb(15, 23, 42)",
  },
};

const CHECK_COLORS: Partial<Record<PublicPlanId, string>> = {
  starter: "rgb(100, 116, 139)",
  pro: "rgb(79, 70, 229)",
  business: "rgb(236, 72, 153)",
  enterprise: "rgb(15, 23, 42)",
};

type HomePlanCopy = {
  period: string;
  description: string;
  features: string[];
  cta: string;
  customPrice: string;
};

/** Sección 07 (planes) — mismos textos que `landing.pricing.plans` en /precios. */
export const LandingBelowSection07: FC = () => {
  const { t, path } = useHomeLiteralT();
  const { t: tPricing, i18n } = useTranslation("landing");

  const planCopyById = useMemo(() => {
    const map = {} as Record<PublicPlanId, HomePlanCopy>;
    for (const id of PRICING_HOME_PLAN_IDS) {
      map[id] = {
        period: tPricing(`pricing.plans.${id}.period`),
        description: tPricing(`pricing.plans.${id}.description`),
        features: i18nAsArray<string>(
          tPricing(`pricing.plans.${id}.features`, { returnObjects: true }),
        ),
        cta: tPricing(`pricing.plans.${id}.cta`),
        customPrice: tPricing(`pricing.plans.${id}.customPrice`, { defaultValue: "" }),
      };
    }
    return map;
  }, [tPricing]);

  const enterpriseMail = `mailto:hello@taimbox.com?subject=${encodeURIComponent(
    tPricing("pricing.enterpriseMailSubject"),
  )}`;

  const {
    currency,
    setCurrency,
    currencyOptions,
    ratesLoading,
    formatMonthly,
    formatUsdAmount,
    billingNote,
  } = usePublicPricingCurrency();

  return (
    <section
      className="relative overflow-hidden"
      style={landingInlineStyle(
        "background: rgb(250, 245, 232); padding-top: clamp(5rem, 10vw, 8rem); padding-bottom: clamp(7rem, 12vw, 10rem);",
      )}
    >
      <div className="relative max-w-[1280px] mx-auto px-6 lg:px-10">
        <div
          className="max-w-3xl mb-8 mx-auto text-center"
          style={landingInlineStyle("opacity: 1; transform: none;")}
        >
          <span className="inline-block font-mono text-[10px] uppercase tracking-[0.24em] text-amber-700 mb-3">
            {t("s07.kicker")}
          </span>
          <h2 className="text-[2rem] sm:text-4xl lg:text-5xl font-semibold text-slate-900 leading-[1.1] -tracking-[0.02em] mb-4">
            {t("s07.title")}{" "}
            <span className="italic text-amber-700">{t("s07.titleHighlight")}</span>
          </h2>
          <p className="text-[15px] sm:text-[16px] text-slate-600 leading-relaxed mb-5">
            {t("s07.subtitle")}
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 border border-amber-600/30 text-amber-950 text-xs font-semibold uppercase tracking-wider">
            <Rocket className="h-3.5 w-3.5 text-amber-700 shrink-0" aria-hidden />
            {tPricing("pricing.earlyAdopter")}
          </div>
        </div>

        <LandingPricingCurrencySelect
          currency={currency}
          onCurrencyChange={setCurrency}
          options={currencyOptions}
          loading={ratesLoading}
          variant="light"
        />
        <p className="text-center text-[11px] text-slate-500 max-w-xl mx-auto -mt-4 mb-10">
          {billingNote}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
          {PUBLIC_PLAN_PRICING.filter((p) => PRICING_HOME_PLAN_IDS.includes(p.id)).map((pricing) => {
            const copy = planCopyById[pricing.id];
            if (!copy) return null;

            const shell = PLAN_ICONS[pricing.id];
            if (!shell) return null;

            const Icon = shell.icon;
            const featured = pricing.featuredOnHome === true;
            const displayName = PUBLIC_PLAN_LABELS[pricing.id];
            const checkClass = CHECK_COLORS[pricing.id] ?? "rgb(100, 116, 139)";
            const isEnterprise = pricing.usdMonthly == null;
            const hasEarlyDiscount =
              pricing.usdMonthlyOfficial != null && pricing.usdMonthly != null;

            const priceDisplay = isEnterprise
              ? copy.customPrice
              : pricing.usdMonthly === 0
                ? formatUsdAmount(0)
                : formatMonthly(pricing.usdMonthly!);

            const priceWasDisplay =
              hasEarlyDiscount && pricing.usdMonthlyOfficial != null
                ? formatMonthly(pricing.usdMonthlyOfficial)
                : null;

            const ctaHref =
              pricing.id === "enterprise" ? enterpriseMail : path(pricing.href);

            return (
              <div
                key={pricing.id}
                className={
                  featured
                    ? "group relative rounded-2xl p-6 sm:p-7 pt-8 sm:pt-9 flex flex-col bg-slate-900 text-white ring-1 ring-violet-400/30"
                    : "group relative rounded-2xl p-6 sm:p-7 flex flex-col bg-white text-slate-900 border border-slate-200/70"
                }
                style={landingInlineStyle(
                  featured
                    ? "box-shadow: rgba(124, 58, 237, 0.6) 0px 30px 80px -25px, rgba(15, 23, 42, 0.2) 0px 14px 40px -16px; opacity: 1; transform: none;"
                    : "box-shadow: rgba(15, 23, 42, 0.04) 0px 1px 2px, rgba(15, 23, 42, 0.08) 0px 12px 36px -16px; opacity: 1; transform: none;",
                )}
              >
                {pricing.recommended ? (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg shadow-purple-500/30">
                      {tPricing("pricing.recommended")}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center gap-2.5 mb-4">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center"
                    style={landingInlineStyle(`background: ${shell.bg};`)}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={landingInlineStyle(`color: ${shell.color};`)}
                      aria-hidden
                    />
                  </div>
                  <span className="text-[15px] font-semibold">{displayName}</span>
                </div>

                <p
                  className={`text-[13px] leading-snug min-h-[40px] mb-5 ${featured ? "text-white/65" : "text-slate-500"}`}
                >
                  {copy.description}
                </p>

                <div className="mb-6">
                  {priceWasDisplay ? (
                    <div
                      className={`text-[13px] line-through tabular-nums mb-0.5 ${featured ? "text-white/40" : "text-slate-400"}`}
                    >
                      {priceWasDisplay}
                    </div>
                  ) : null}
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span
                      className={
                        isEnterprise
                          ? "text-3xl sm:text-4xl font-semibold tabular-nums -tracking-[0.03em]"
                          : "text-4xl sm:text-5xl font-semibold tabular-nums -tracking-[0.04em]"
                      }
                    >
                      {priceDisplay}
                    </span>
                    {!isEnterprise && copy.period ? (
                      <span
                        className={`text-[13px] font-medium ${featured ? "text-white/55" : "text-slate-500"}`}
                      >
                        / {copy.period}
                      </span>
                    ) : null}
                  </div>
                  {hasEarlyDiscount ? (
                    <p
                      className={`mt-1.5 inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                        featured ? "text-amber-200" : "text-amber-800"
                      }`}
                    >
                      <Sparkles
                        className={`h-3 w-3 shrink-0 ${featured ? "text-amber-300" : "text-amber-600"}`}
                        aria-hidden
                      />
                      {tPricing("pricing.earlyTariff")}
                    </p>
                  ) : null}
                </div>

                <ul className="space-y-2.5 mb-7 flex-1">
                  {copy.features.map((feature, i) => (
                    <li
                      key={`${pricing.id}-${i}`}
                      className={`flex items-start gap-2.5 text-[13px] leading-snug ${featured ? "text-white/85" : "text-slate-700"}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-check h-3.5 w-3.5 mt-0.5 shrink-0"
                        style={landingInlineStyle(`color: ${featured && pricing.id === "pro" ? "rgb(167, 243, 208)" : checkClass};`)}
                        aria-hidden
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span
                        className={
                          i === 0 && pricing.id !== "starter"
                            ? featured
                              ? "font-semibold text-white"
                              : "font-semibold text-slate-900"
                            : undefined
                        }
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  className={
                    featured
                      ? "group/cta inline-flex items-center justify-center gap-2 h-11 rounded-full text-[13.5px] font-semibold transition-all bg-white text-slate-900 hover:bg-slate-100"
                      : "group/cta inline-flex items-center justify-center gap-2 h-11 rounded-full text-[13.5px] font-semibold transition-all bg-slate-900 text-white hover:bg-slate-800"
                  }
                  href={ctaHref}
                >
                  <span>{copy.cta}</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5"
                    aria-hidden
                  />
                </a>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <a
            className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-slate-700 hover:text-slate-900 border-b border-slate-400 hover:border-slate-800 pb-0.5 transition-colors"
            href={path(t("s07.compareHref"))}
          >
            {t("s07.compareLink")}
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </a>
        </div>
      </div>
      <svg
        aria-hidden
        className="absolute left-0 right-0 bottom-0 w-full pointer-events-none h-14 sm:h-20"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
      >
        <path d="M0,100 C360,20 1080,20 1440,100 L1440,120 L0,120 Z" fill="#ffffff" />
      </svg>
    </section>
  );
};
