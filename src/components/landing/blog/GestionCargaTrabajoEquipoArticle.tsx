import { LocaleLink } from './LocaleLink';
import { Button } from '@/components/ui/button';
import { HeartPulse, Scale, ShieldAlert, BarChart3 } from 'lucide-react';
import { RevealOnScroll } from './RevealOnScroll';
import { BlogReadingTime } from './BlogReadingTime';
import { BlogTOC } from './BlogTOC';
import { BlogRelatedPost } from './BlogRelatedPost';
import type { BlogTOCItem } from './BlogTOC';
import { CargaTrabajoFrameworkVisual } from './CargaTrabajoFrameworkVisual';
import { SenalesCargaAlertaVisual } from './SenalesCargaAlertaVisual';
import { useTranslation } from 'react-i18next';
import { sanitizeInlineHtml } from '@/lib/blog/sanitize';
import { parseGestionCapsule } from '@/lib/blogLocaleLinkSplit';

export interface GestionCargaTrabajoEquipoArticleProps {
  readingMinutes?: number;
  tocItems?: BlogTOCItem[];
  relatedPost?: { title: string; description: string; href: string };
}

export function GestionCargaTrabajoEquipoArticle({
  readingMinutes,
  tocItems,
  relatedPost,
}: GestionCargaTrabajoEquipoArticleProps) {
  const { t } = useTranslation('blog');
  const postKey = 'gestionCargaTrabajoEquipo';
  const capsule = parseGestionCapsule(t(`posts.${postKey}.intro.capsule`));

  return (
    <article
      id="gestion-carga-trabajo-equipo-sin-burnout"
      className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14 md:py-16 text-left overflow-x-hidden"
    >
      <section className="mb-12 sm:mb-14">
        <div className="mb-6 text-center flex flex-col items-center gap-3">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-violet-300 bg-violet-500/20 border border-violet-400/30">
            {t(`posts.${postKey}.badge`)}
          </span>
          {readingMinutes != null && <BlogReadingTime minutes={readingMinutes} />}
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-[2.75rem] font-black text-white mb-5 sm:mb-6 leading-[1.15] tracking-tight text-center">
          {t(`posts.${postKey}.title`)}
        </h1>
        <div className="space-y-5 text-indigo-100/95 text-base sm:text-lg leading-[1.75]">
          <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.intro.p1`)) }} />
          <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.intro.p2`)) }} />
          <div className="rounded-2xl border-l-4 border-violet-400 bg-violet-500/10 border border-violet-500/20 p-4 sm:p-6 my-6">
            <p className="text-white/95 font-medium m-0">
              {capsule.ok === true ? (
                <>
                  {capsule.p.before1}
                  <LocaleLink to="/blog/planificacion-proyectos-cronograma-recursos" className="text-violet-300 hover:text-white underline underline-offset-2">
                    {capsule.p.link1}
                  </LocaleLink>
                  {capsule.p.between12}
                  <LocaleLink to="/blog/kpis-agencias-marketing-2026" className="text-violet-300 hover:text-white underline underline-offset-2">
                    {capsule.p.link2}
                  </LocaleLink>
                  {capsule.p.between23}
                  <LocaleLink to="/blog/ley-parkinson" className="text-violet-300 hover:text-white underline underline-offset-2">
                    {capsule.p.link3}
                  </LocaleLink>
                  {capsule.p.after3}
                </>
              ) : (
                capsule.plain
              )}
            </p>
          </div>
        </div>
      </section>

      <RevealOnScroll>
        <section id="lo-que-aprenderas" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4">
            {t(`posts.${postKey}.sections.map.title`)}
          </h2>
          <p className="text-indigo-100/90 text-base sm:text-lg leading-relaxed mb-6">
            {t(`posts.${postKey}.sections.map.p1`)}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
            <table className="w-full text-left text-sm sm:text-base">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-3 sm:p-4 text-violet-200 font-semibold">{t(`posts.${postKey}.sections.map.table.headers.0`)}</th>
                  <th className="p-3 sm:p-4 text-violet-200 font-semibold">{t(`posts.${postKey}.sections.map.table.headers.1`)}</th>
                  <th className="p-3 sm:p-4 text-violet-200 font-semibold">{t(`posts.${postKey}.sections.map.table.headers.2`)}</th>
                </tr>
              </thead>
              <tbody className="text-indigo-100/90">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="border-b border-white/10">
                    <td className="p-3 sm:p-4 font-medium text-white align-top">{t(`posts.${postKey}.sections.map.table.rows.${i}.0`)}</td>
                    <td className="p-3 sm:p-4 align-top">{t(`posts.${postKey}.sections.map.table.rows.${i}.1`)}</td>
                    <td className="p-3 sm:p-4 align-top">{t(`posts.${postKey}.sections.map.table.rows.${i}.2`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </RevealOnScroll>

      {tocItems != null && tocItems.length > 0 && (
        <div className="mb-12">
          <BlogTOC items={tocItems} />
        </div>
      )}

      <RevealOnScroll>
        <section id="que-es-carga-trabajo" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6">
            {t(`posts.${postKey}.sections.whatIs.title`)}
          </h2>
          <div className="space-y-4 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.sections.whatIs.p1`)) }} />
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll delay={1}>
        <section id="causas-burnout-equipos" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6">
            {t(`posts.${postKey}.sections.causes.title`)}
          </h2>
          <div className="space-y-4 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.sections.causes.p1`)) }} />
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll delay={2}>
        <section id="senales-equipo-riesgo" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6">
            {t(`posts.${postKey}.sections.signals.title`)}
          </h2>
          <div className="space-y-4 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.sections.signals.p1`)) }} />
          </div>

          <div className="my-8">
            <SenalesCargaAlertaVisual />
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll>
        <section id="framework-gestion-sostenible" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-3">
            <Scale className="h-8 w-8 text-violet-400 shrink-0" aria-hidden />
            {t(`posts.${postKey}.sections.framework.title`)}
          </h2>
          <p className="text-indigo-100/90 text-base sm:text-lg leading-relaxed mb-6">
            {t(`posts.${postKey}.sections.framework.p1`)}
          </p>

          <div className="mb-10">
            <CargaTrabajoFrameworkVisual />
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll delay={1}>
        <section id="rol-manager-equipo" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-3">
            <HeartPulse className="h-8 w-8 text-rose-400 shrink-0" aria-hidden />
            {t(`posts.${postKey}.sections.manager.title`)}
          </h2>
          <div className="space-y-8 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.sections.manager.p1`)) }} />
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll delay={2}>
        <section id="burnout-instalado" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-amber-400 shrink-0" aria-hidden />
            {t(`posts.${postKey}.sections.installed.title`)}
          </h2>
          <div className="space-y-6 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.sections.installed.p1`)) }} />
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll>
        <section id="metricas-carga-equipo" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6 flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-emerald-400 shrink-0" aria-hidden />
            {t(`posts.${postKey}.sections.metrics.title`)}
          </h2>
          <div className="space-y-4 text-indigo-100/90 text-base sm:text-lg leading-relaxed mb-6">
            <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.sections.metrics.p1`)) }} />
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll delay={1}>
        <section id="herramientas-workload" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6">
            {t(`posts.${postKey}.sections.tools.title`)}
          </h2>
          <div className="space-y-5 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.sections.tools.p1`)) }} />
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll delay={2}>
        <section id="conclusion-gestion-carga" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-5 sm:mb-6">
            {t(`posts.${postKey}.sections.conclusion.title`)}
          </h2>
          <div className="space-y-5 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.sections.conclusion.p1`)) }} />
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll>
        <section id="faq-gestion-carga-trabajo" className="mb-12 sm:mb-16 scroll-mt-24">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-6">{t(`posts.${postKey}.faq.title`)}</h2>
          <div className="space-y-6 text-indigo-100/90 text-base sm:text-lg leading-relaxed">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-5 sm:p-6 space-y-3">
                <h3 className="text-white font-bold text-lg m-0">{t(`posts.${postKey}.faq.q${i}.q`)}</h3>
                <p className="m-0" dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(t(`posts.${postKey}.faq.q${i}.a`)) }} />
              </div>
            ))}
          </div>
        </section>
      </RevealOnScroll>

      <RevealOnScroll delay={1}>
        <section id="cta-gestion-carga" className="text-center mt-12 mb-8 scroll-mt-24">
          <p className="text-indigo-100/90 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            {t(`posts.${postKey}.cta.p1`)}
          </p>
          <LocaleLink to="/blog/kpis-agencias-marketing-2026">
            <Button
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-10 py-6 text-lg font-bold shadow-xl shadow-violet-500/30 rounded-xl transition-all duration-300 hover:scale-105"
            >
              Ver KPIs de rendimiento
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
        </section>
      </RevealOnScroll>
    </article>
  );
}
