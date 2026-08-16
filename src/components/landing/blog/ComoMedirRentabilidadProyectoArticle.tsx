import { LocaleLink } from './LocaleLink';
import { Button } from '@/components/ui/button';
import { Hourglass, Scale, Calculator, Shield, Rocket } from 'lucide-react';
import { RevealOnScroll } from './RevealOnScroll';
import { BlogReadingTime } from './BlogReadingTime';
import { BlogTOC } from './BlogTOC';
import { BlogRelatedPost } from './BlogRelatedPost';
import type { BlogTOCItem } from './BlogTOC';
import { ScopeProtocoloInfographic } from './ScopeProtocoloInfographic';
import { useTranslation } from 'react-i18next';
import { sanitizeInlineHtml } from '@/lib/blog/sanitize';
import { parseOneLocaleLink, parseTwoLocaleLinks } from '@/lib/blogLocaleLinkSplit';

export interface ComoMedirRentabilidadProyectoArticleProps {
  readingMinutes?: number;
  tocItems?: BlogTOCItem[];
  relatedPost?: { title: string; description: string; href: string };
}

export function ComoMedirRentabilidadProyectoArticle({
  readingMinutes,
  tocItems,
  relatedPost,
}: ComoMedirRentabilidadProyectoArticleProps) {
  const { t } = useTranslation('blog');
  const postKey = 'comoMedirRentabilidadProyecto';
  const introP1 = parseOneLocaleLink(t(`posts.${postKey}.intro.p1`));
  const section5p2 = parseTwoLocaleLinks(t(`posts.${postKey}.section5.p2`));

  return (
    <article
      id="como-medir-rentabilidad-proyecto"
      className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14 md:py-16 text-left overflow-x-hidden"
    >
      <section className="mb-12 sm:mb-14">
        <div className="mb-6 text-center flex flex-col items-center gap-3">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-cyan-300 bg-cyan-500/20 border border-cyan-400/30">
            {t(`posts.${postKey}.badge`)}
          </span>
          {readingMinutes != null && <BlogReadingTime minutes={readingMinutes} />}
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-[2.75rem] font-black text-white mb-5 sm:mb-6 leading-[1.15] tracking-tight text-center">
          {t(`posts.${postKey}.title`)}
        </h1>

        <div className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-4 sm:p-6 mb-8">
          <p className="text-cyan-100/95 text-sm font-semibold uppercase tracking-wide mb-3">{t(`posts.${postKey}.tldr.title`)}</p>
          <ol className="space-y-3 text-indigo-100/95 text-base sm:text-lg leading-relaxed list-decimal list-outside pl-5 sm:pl-6 marker:text-cyan-300 marker:font-semibold">
            <li>{t(`posts.${postKey}.tldr.item1`)}</li>
            <li>{t(`posts.${postKey}.tldr.item2`)}</li>
            <li>{t(`posts.${postKey}.tldr.item3`)}</li>
          </ol>
        </div>

        <div className="space-y-5 text-indigo-100/95 text-base sm:text-lg leading-[1.75]">
          <p>
            {introP1.ok === true ? (
              <>
                {introP1.p.before}
                <LocaleLink to="/blog/por-que-tu-agencia-pierde-rentabilidad-equipo-ocupado" className="text-violet-300 hover:text-white underline underline-offset-2">
                  {introP1.p.link}
                </LocaleLink>
                {introP1.p.after}
              </>
            ) : (
              introP1.plain
            )}
          </p>
          <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.intro.p2`)) }} />
        </div>
      </section>

      {tocItems != null && tocItems.length > 0 && (
        <div className="mb-12">
          <BlogTOC items={tocItems} />
        </div>
      )}

      <RevealOnScroll>
        <section id="techo-horas" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-3">
            <Hourglass className="h-8 w-8 text-amber-400 shrink-0" aria-hidden />
            {t(`posts.${postKey}.section1.title`)}
          </h2>
          <div className="space-y-4 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.section1.p1`)) }} />
            <p>{t(`posts.${postKey}.section1.p2`)}</p>
            <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.section1.p3`)) }} />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-white mt-8 mb-3">{t(`posts.${postKey}.section1.sub.title`)}</h3>
          <p className="text-indigo-100/90 text-base sm:text-lg leading-relaxed mb-4">
            {t(`posts.${postKey}.section1.sub.p1`)}
          </p>
        </section>
      </RevealOnScroll>

      <RevealOnScroll delay={1}>
        <section id="modelos-pricing" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-3">
            <Scale className="h-8 w-8 text-indigo-400 shrink-0" aria-hidden />
            {t(`posts.${postKey}.section2.title`)}
          </h2>
          <div className="space-y-4 text-indigo-100/90 text-base sm:text-lg leading-relaxed mb-8">
            <p>{t(`posts.${postKey}.section2.p1`)}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 transition-all duration-300 hover:border-indigo-500/30">
              <h4 className="text-white font-bold text-lg mb-3 flex items-center justify-between">
                <span>{t(`posts.${postKey}.section2.hourly.title`)}</span>
                <span className="text-xs uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">T&M</span>
              </h4>
              <p className="text-emerald-400 text-sm mb-2"><strong>Pros:</strong> {t(`posts.${postKey}.section2.hourly.pros`)}</p>
              <p className="text-rose-400 text-sm"><strong>Contras:</strong> {t(`posts.${postKey}.section2.hourly.cons`)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 transition-all duration-300 hover:border-emerald-500/30">
              <h4 className="text-white font-bold text-lg mb-3 flex items-center justify-between">
                <span>{t(`posts.${postKey}.section2.fixed.title`)}</span>
                <span className="text-xs uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Fixed</span>
              </h4>
              <p className="text-emerald-400 text-sm mb-2"><strong>Pros:</strong> {t(`posts.${postKey}.section2.fixed.pros`)}</p>
              <p className="text-rose-400 text-sm"><strong>Contras:</strong> {t(`posts.${postKey}.section2.fixed.cons`)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 transition-all duration-300 hover:border-purple-500/30">
              <h4 className="text-white font-bold text-lg mb-3 flex items-center justify-between">
                <span>{t(`posts.${postKey}.section2.retainer.title`)}</span>
                <span className="text-xs uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">Fee</span>
              </h4>
              <p className="text-emerald-400 text-sm mb-2"><strong>Pros:</strong> {t(`posts.${postKey}.section2.retainer.pros`)}</p>
              <p className="text-rose-400 text-sm"><strong>Contras:</strong> {t(`posts.${postKey}.section2.retainer.cons`)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-5 sm:p-8">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="h-6 w-6 text-violet-400" aria-hidden />
              {t(`posts.${postKey}.section2.hybrid.title`)}
            </h3>
            <p className="text-indigo-100/90 text-base sm:text-lg leading-relaxed m-0" dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.section2.hybrid.p1`)) }} />
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll delay={1}>
        <section id="calcular-rentabilidad" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-3">
            <Calculator className="h-8 w-8 text-emerald-400 shrink-0" aria-hidden />
            {t(`posts.${postKey}.section3.title`)}
          </h2>
          <div className="space-y-4 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.section3.p1`)) }} />

            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/50 p-6 sm:p-8 my-8 text-center ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-widest text-indigo-300 mb-2 font-bold">{t(`posts.${postKey}.section3.formula.title`)}</p>
              <div className="text-xl sm:text-2xl md:text-3xl font-black text-white py-4 font-mono transition-transform duration-300">
                {t(`posts.${postKey}.section3.formula.text`)}
              </div>
              <p className="text-sm text-indigo-200/80 mt-4 max-w-lg mx-auto" dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.section3.formula.p1`)) }} />
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white mb-3">{t(`posts.${postKey}.section3.benchmark.title`)}</h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <p className="m-0 text-indigo-100/90">{t(`posts.${postKey}.section3.benchmark.healthy`)}</p>
              </li>
              <li className="flex gap-3">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <p className="m-0 text-indigo-100/90">{t(`posts.${postKey}.section3.benchmark.danger`)}</p>
              </li>
            </ul>
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll>
        <section id="scope-creep-protocolo" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-3">
            <Shield className="h-8 w-8 text-rose-500 shrink-0" aria-hidden />
            {t(`posts.${postKey}.section4.title`)}
          </h2>
          <div className="space-y-4 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            <p>{t(`posts.${postKey}.section4.p1`)}</p>
            <div className="my-8">
              <ScopeProtocoloInfographic
                step1={t(`posts.${postKey}.section4.steps.1`)}
                step2={t(`posts.${postKey}.section4.steps.2`)}
                step3={t(`posts.${postKey}.section4.steps.3`)}
              />
            </div>
            <p className="italic text-indigo-200/80 text-sm">
              * El protocolo funciona si el líder lo protege; si dirección acepta cambios sin registrar, el equipo seguirá trabajando horas invisibles.
            </p>
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll delay={1}>
        <section id="modelo-sprint" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-3">
            <Rocket className="h-8 w-8 text-cyan-400 shrink-0" aria-hidden />
            {t(`posts.${postKey}.section5.title`)}
          </h2>
          <div className="space-y-4 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            <p>{t(`posts.${postKey}.section5.p1`)}</p>
            <p>
              {section5p2.ok === true ? (
                <>
                  {section5p2.p.before1}
                  <LocaleLink to="/blog/plantilla-planificacion-recursos-agencia" className="text-cyan-300 hover:text-white underline underline-offset-2">
                    {section5p2.p.link1}
                  </LocaleLink>
                  {section5p2.p.between}
                  <LocaleLink to="/blog/kpis-agencias-marketing-2026" className="text-cyan-300 hover:text-white underline underline-offset-2">
                    {section5p2.p.link2}
                  </LocaleLink>
                  {section5p2.p.after}
                </>
              ) : (
                section5p2.plain
              )}
            </p>
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll delay={1}>
        <section id="faq-rentabilidad-proyecto" className="mb-12 sm:mb-16 scroll-mt-24">
          <div className="rounded-3xl border border-indigo-500/30 bg-indigo-950/40 p-6 sm:p-10">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-5 text-center">
              {t(`posts.${postKey}.faq.title`)}
            </h2>
            <div className="space-y-6">
              <div>
                <h4 className="text-white font-semibold mb-2">{t(`posts.${postKey}.faq.q1.q`)}</h4>
                <p className="text-sm text-indigo-200/90">{t(`posts.${postKey}.faq.q1.a`)}</p>
              </div>
              <div className="w-full h-px bg-white/10" />
              <div>
                <h4 className="text-white font-semibold mb-2">{t(`posts.${postKey}.faq.q2.q`)}</h4>
                <p className="text-sm text-indigo-200/90">{t(`posts.${postKey}.faq.q2.a`)}</p>
              </div>
              <div className="w-full h-px bg-white/10" />
              <div>
                <h4 className="text-white font-semibold mb-2">{t(`posts.${postKey}.faq.q3.q`)}</h4>
                <p className="text-sm text-indigo-200/90">{t(`posts.${postKey}.faq.q3.a`)}</p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12 mb-8">
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">{t(`posts.${postKey}.cta.title`)}</h2>
            <p className="text-indigo-100/90 text-lg mb-8 max-w-2xl mx-auto">
              {t(`posts.${postKey}.cta.p1`)}
            </p>
            <LocaleLink to="/reportes-rentabilidad">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-10 py-6 text-lg font-bold shadow-xl shadow-cyan-500/30 rounded-xl transition-all duration-300 hover:scale-105"
              >
                {t(`posts.${postKey}.cta.button`)}
              </Button>
            </LocaleLink>
            {relatedPost != null && (
              <div className="mt-12 max-w-xl mx-auto">
                <BlogRelatedPost
                  title={relatedPost.title}
                  description={relatedPost.description}
                  href={relatedPost.href}
                />
              </div>
            )}
            <p className="text-indigo-300 text-sm mt-6 italic">
              Escrito por el equipo de Análisis de Taimbox — Rentabilidad y eficiencia para agencias.
            </p>
          </div>
        </section>
      </RevealOnScroll>
    </article>
  );
}

// Fixed Button component as the original used a shadcn button, but I'll make sure to use LocaleLink for navigation.
// Actually, the original file used Button from '@/components/ui/button'. Let's keep that.
