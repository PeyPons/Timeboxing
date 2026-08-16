import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FC } from "react";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  CalendarRange,
  ChartLine,
  Check,
  LayoutDashboard,
  Sparkles,
  Target,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { landingInlineStyle } from "@/components/landing/below/landingInlineStyle";
import { LandingBrowserFrame } from "@/components/landing/below/LandingBrowserFrame";
import { LANDING_BROWSER_NAV } from "@/components/landing/below/landingBrowserNav";
import { useHomeLiteralT } from "@/components/landing/below/useHomeLiteralT";
import { cn } from "@/lib/utils";
import { i18nAsArray } from "@/lib/i18nReturnObjects";

type Role = {
  /** Color principal (rgb(...)) usado en pastilla, badge, bullets, sombra del mockup. */
  color: string;
  label: string;
  icon: LucideIcon;
  badgeText: string;
  heading: string;
  description: string;
  bullets: [string, string, string];
  linkText: string;
  linkHref: string;
  Mockup: FC;
};

function rgba(rgb: string, alpha: number): string {
  const m = /^rgb\(([^)]+)\)$/.exec(rgb);
  return m ? `rgba(${m[1]}, ${alpha})` : rgb;
}

/* ─────────────────────── Mockups por rol ────────────────────── */


type DirWeek = { hours: string; pct: number; status: "ok" | "warn" | "over" | "away" };
type DirPerson = {
  initials: string;
  name: string;
  color: string;
  weeks: DirWeek[];
  total: string;
  cap: string;
  rowStatus: "ok" | "over";
};

/* Directores → Planificador (capacidad efectiva en grid con heatmap) */
const DIR_BG: Record<string, string> = { ok: "rgba(236,253,244,0.5)", warn: "rgba(255,251,235,0.6)", over: "rgba(254,242,242,0.8)", away: "rgba(248,250,252,0.7)" };
const DIR_BAR: Record<string, string> = { ok: "rgb(16,185,129)", warn: "rgb(245,158,11)", over: "rgb(239,68,68)", away: "rgb(148,163,184)" };
const DIR_TX: Record<string, string> = { ok: "rgb(22,163,74)", warn: "rgb(217,119,6)", over: "rgb(220,38,38)", away: "rgb(100,116,139)" };

const DirectoresMockup: FC = () => {
  const { t } = useHomeLiteralT();
  const m = t("s03.mocks.directores", { returnObjects: true }) as {
    moduleLabel: string;
    scope: string;
    overloadBadge: string;
    weekCols: string[];
    totalCol: string;
    capacityLabel: string;
    capacityPct: string;
    legendOk: string;
    legendHigh: string;
    legendOver: string;
    people: DirPerson[];
  };
  const people = i18nAsArray<DirPerson>(m.people);
  const weekCols = i18nAsArray<string>(m.weekCols);

  return (
    <LandingBrowserFrame accent="rgb(99, 102, 241)" activeNav={LANDING_BROWSER_NAV.planner}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">{m.moduleLabel}</div>
          <div className="text-[14px] font-semibold text-slate-900 mt-0.5">{m.scope}</div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100">
          <TriangleAlert className="h-2.5 w-2.5 text-rose-600" />
          <span className="font-mono text-[10px] text-rose-700">{m.overloadBadge}</span>
        </span>
      </div>
      <div className="grid grid-cols-[72px_repeat(3,1fr)_52px] gap-1.5">
        <div />
        {weekCols.map((w) => (
          <div key={w} className="text-center font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">
            {w}
          </div>
        ))}
        <div className="text-center font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">{m.totalCol}</div>
        {people.map((p, pi) => (
          <div key={pi} className="contents">
            <div className="flex items-center gap-1.5 py-0.5">
              <div
                className="h-5 w-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                style={landingInlineStyle(`background: ${p.color};`)}
              >
                {p.initials}
              </div>
              <span className="text-[11px] text-slate-700 truncate">{p.name}</span>
            </div>
            {p.weeks.map((w, wi) => (
              <div
                key={wi}
                className="relative rounded-md border overflow-hidden flex flex-col items-center justify-center"
                style={landingInlineStyle(
                  w.status === "away"
                    ? `background: repeating-linear-gradient(45deg, rgba(148,163,184,0.15) 0px, rgba(148,163,184,0.15) 3px, transparent 3px, transparent 6px) rgb(248,250,252); border-color: rgb(226,232,240); height: 32px;`
                    : `background: ${DIR_BG[w.status]}; border-color: ${w.status === "ok" ? "rgb(167,243,208)" : w.status === "warn" ? "rgb(253,230,138)" : "rgb(254,202,202)"}; height: 32px;`,
                )}
              >
                <span
                  className="font-mono text-[10px] font-semibold tabular-nums"
                  style={landingInlineStyle(`color: ${DIR_TX[w.status]};`)}
                >
                  {w.hours}
                </span>
                {w.status !== "away" && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/[0.04]">
                    <div
                      className="h-full rounded-full"
                      style={landingInlineStyle(
                        `background: ${DIR_BAR[w.status]}; width: ${Math.min(w.pct, 100)}%;`,
                      )}
                    />
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center justify-center">
              <span
                className="font-mono text-[10px] font-semibold tabular-nums"
                style={landingInlineStyle(
                  `color: ${p.rowStatus === "over" ? "rgb(220,38,38)" : "rgb(51,65,85)"};`,
                )}
              >
                {p.total}
                <span className="text-slate-400 font-normal">{p.cap}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-end justify-between">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">{m.capacityLabel}</div>
          <div className="text-xl font-semibold tabular-nums text-indigo-600 -tracking-[0.02em]">{m.capacityPct}</div>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {m.legendOk}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {m.legendHigh}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> {m.legendOver}
          </span>
        </div>
      </div>
    </LandingBrowserFrame>
  );
};

/* Empleados → Mi espacio (timer + cierre de tareas) */
type EmpTask = {
  status: "running" | "done" | "pending";
  title: string;
  client: string;
  time: string;
  color: string;
  bg: string;
  border: string;
};

/* Empleados → Mi espacio (timer + cierre de tareas) */
const EmpleadosMockup: FC = () => {
  const { t } = useHomeLiteralT();
  const m = t("s03.mocks.empleados", { returnObjects: true }) as {
    moduleLabel: string;
    scope: string;
    timerBadge: string;
    statusRunning: string;
    statusDone: string;
    statusPending: string;
    weekTotalLabel: string;
    weekTotal: string;
    tasks: EmpTask[];
  };
  const tasks = i18nAsArray<EmpTask>(m.tasks);

  const statusLabel = (status: EmpTask["status"]) => {
    if (status === "done") return m.statusDone;
    if (status === "running") return m.statusRunning;
    return m.statusPending;
  };

  return (
    <LandingBrowserFrame accent="rgb(139, 92, 246)" activeNav={LANDING_BROWSER_NAV.home}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">{m.moduleLabel}</div>
          <div className="text-[14px] font-semibold text-slate-900 mt-0.5">{m.scope}</div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-100">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" />
          </span>
          <span className="font-mono text-[10px] text-violet-700">{m.timerBadge}</span>
        </span>
      </div>
      <div className="space-y-1.5 mb-3">
        {tasks.map((task, i) => (
          <div
            key={i}
            className="grid grid-cols-[20px_1fr_auto_auto] gap-2 items-center p-2 rounded-lg border"
            style={landingInlineStyle(`background: ${task.bg}; border-color: ${task.border};`)}
          >
            <div
              className="h-4 w-4 rounded-md flex items-center justify-center"
              style={landingInlineStyle(`background: ${task.color};`)}
            >
              {task.status === "done" ? (
                <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
              ) : task.status === "running" ? (
                <span className="h-1.5 w-1.5 rounded-sm bg-white" />
              ) : (
                <span className="h-2 w-2 rounded-full border-2 border-white" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-slate-800 truncate">{task.title}</div>
              <div className="font-mono text-[9px] text-slate-500 truncate">{task.client}</div>
            </div>
            <div className="font-mono text-[10px] tabular-nums text-slate-600 whitespace-nowrap">{task.time}</div>
            <span
              className="font-mono text-[9px] font-semibold whitespace-nowrap"
              style={landingInlineStyle(`color: ${task.color};`)}
            >
              {statusLabel(task.status)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">{m.weekTotalLabel}</span>
        <span className="font-mono text-[11px] tabular-nums font-semibold text-slate-800">{m.weekTotal}</span>
      </div>
    </LandingBrowserFrame>
  );
};

type OpsStatus = "inRule" | "behind" | "overHours" | "noActivity" | "needsPlanning";
type OpsProject = { name: string; type: string; status: OpsStatus; statusLabel: string };

const OPS_STATUS: Record<OpsStatus, { bg: string; border: string; color: string; dot: string }> = {
  inRule: {
    bg: "rgb(236, 253, 245)",
    border: "rgba(16, 185, 129, 0.2)",
    color: "rgb(22, 163, 74)",
    dot: "rgb(16, 185, 129)",
  },
  behind: {
    bg: "rgb(254, 242, 242)",
    border: "rgba(239, 68, 68, 0.2)",
    color: "rgb(220, 38, 38)",
    dot: "rgb(239, 68, 68)",
  },
  overHours: {
    bg: "rgb(255, 251, 235)",
    border: "rgba(245, 158, 11, 0.22)",
    color: "rgb(217, 119, 6)",
    dot: "rgb(245, 158, 11)",
  },
  noActivity: {
    bg: "rgb(248, 250, 252)",
    border: "rgba(100, 116, 139, 0.18)",
    color: "rgb(71, 85, 105)",
    dot: "rgb(148, 163, 184)",
  },
  needsPlanning: {
    bg: "rgb(245, 243, 255)",
    border: "rgba(139, 92, 246, 0.2)",
    color: "rgb(109, 40, 217)",
    dot: "rgb(139, 92, 246)",
  },
};

/* Project Managers → Seguimiento operativo */
const ProjectManagersMockup: FC = () => {
  const { t } = useHomeLiteralT();
  const m = t("s03.mocks.projectManagers", { returnObjects: true }) as {
    moduleLabel: string;
    scope: string;
    riskBadge: string;
    filters: string[];
    activeFilter: string;
    colProject: string;
    colStatus: string;
    projects: OpsProject[];
    blockingLabel: string;
    blockingCount: string;
    healthyPct: string;
  };
  const filters = i18nAsArray<string>(m.filters);
  const projects = i18nAsArray<OpsProject>(m.projects);

  return (
    <LandingBrowserFrame accent="rgb(245, 158, 11)" activeNav={LANDING_BROWSER_NAV.operations}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">{m.moduleLabel}</div>
          <div className="text-[14px] font-semibold text-slate-900 mt-0.5">{m.scope}</div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100">
          <TriangleAlert className="h-2.5 w-2.5 text-rose-600" />
          <span className="font-mono text-[10px] text-rose-700">{m.riskBadge}</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {filters.map((f) => {
          const active = f === m.activeFilter;
          return (
            <span
              key={f}
              className={cn(
                "px-2 py-0.5 rounded-full font-mono text-[9px] border transition-colors",
                active
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-slate-500 border-slate-200",
              )}
            >
              {f}
            </span>
          );
        })}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">{m.colProject}</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400 text-right min-w-[88px]">
          {m.colStatus}
        </div>
      </div>
      <div className="space-y-1.5">
        {projects.map((p, i) => {
          const cfg = OPS_STATUS[p.status] ?? OPS_STATUS.inRule;
          return (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-slate-800 truncate">{p.name}</div>
                <div className="font-mono text-[9px] text-slate-400">{p.type}</div>
              </div>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border font-mono text-[9px] font-semibold whitespace-nowrap"
                style={landingInlineStyle(
                  `background: ${cfg.bg}; border-color: ${cfg.border}; color: ${cfg.color};`,
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={landingInlineStyle(`background: ${cfg.dot};`)}
                />
                {p.statusLabel}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          <span className="font-mono">
            {m.blockingCount} {m.blockingLabel.toLowerCase()}
          </span>
        </span>
        <span className="font-mono text-[10px] tabular-nums font-semibold text-slate-600">{m.healthyPct}</span>
      </div>
    </LandingBrowserFrame>
  );
};

type HrPerson = {
  name: string;
  role: string;
  initials: string;
  color: string;
  cap: number;
  status: "ok" | "over" | "away";
  note: string;
};

/* RRHH → Capacidad de equipo */
const RRHHMockup: FC = () => {
  const { t } = useHomeLiteralT();
  const m = t("s03.mocks.rrhh", { returnObjects: true }) as {
    moduleLabel: string;
    scope: string;
    capacityBadge: string;
    statusOk: string;
    statusOver: string;
    statusAway: string;
    summaryAvailable: string;
    summaryOver: string;
    summaryAbsences: string;
    people: HrPerson[];
    counts: { available: string; over: string; absences: string };
  };
  const people = i18nAsArray<HrPerson>(m.people);

  return (
    <LandingBrowserFrame accent="rgb(8, 145, 178)" activeNav={LANDING_BROWSER_NAV.capacity}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">{m.moduleLabel}</div>
          <div className="text-[14px] font-semibold text-slate-900 mt-0.5">{m.scope}</div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-100">
          <Users className="h-2.5 w-2.5 text-cyan-700" />
          <span className="font-mono text-[10px] text-cyan-700">{m.capacityBadge}</span>
        </span>
      </div>
      <div className="space-y-1.5 mb-3">
        {people.map((p, i) => {
          const cfg =
            p.status === "ok"
              ? {
                  bg: "rgb(236, 253, 245)",
                  border: "rgba(16, 185, 129, 0.18)",
                  color: "rgb(16, 185, 129)",
                  label: m.statusOk,
                }
              : p.status === "over"
                ? {
                    bg: "rgb(254, 242, 242)",
                    border: "rgba(239, 68, 68, 0.18)",
                    color: "rgb(220, 38, 38)",
                    label: m.statusOver,
                  }
                : {
                    bg: "rgb(248, 250, 252)",
                    border: "rgba(100, 116, 139, 0.16)",
                    color: "rgb(100, 116, 139)",
                    label: m.statusAway,
                  };
          return (
            <div
              key={i}
              className="grid grid-cols-[24px_1fr_auto_auto] gap-2.5 items-center p-2 rounded-lg border"
              style={landingInlineStyle(`background: ${cfg.bg}; border-color: ${cfg.border};`)}
            >
              <div
                className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
                style={landingInlineStyle(`background: ${p.color};`)}
              >
                {p.initials}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-slate-800 truncate">{p.name}</div>
                <div className="font-mono text-[9px] text-slate-500 truncate">
                  {p.role} · {p.note}
                </div>
              </div>
              <div className="font-mono text-[10px] tabular-nums text-slate-700 whitespace-nowrap">{p.cap}%</div>
              <span
                className="font-mono text-[9px] font-semibold whitespace-nowrap"
                style={landingInlineStyle(`color: ${cfg.color};`)}
              >
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">{m.summaryAvailable}</div>
          <div className="text-[14px] font-semibold tabular-nums text-emerald-600">{m.counts.available}</div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">{m.summaryOver}</div>
          <div className="text-[14px] font-semibold tabular-nums text-rose-600">{m.counts.over}</div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">{m.summaryAbsences}</div>
          <div className="text-[14px] font-semibold tabular-nums text-slate-600">{m.counts.absences}</div>
        </div>
      </div>
    </LandingBrowserFrame>
  );
};

type FinKpi = { label: string; value: string; sub: string; color: string; bg: string };
type FinPacing = { name: string; pct: number; target: number; color: string };

/* Finanzas → Rentabilidad (F1–F4) */
const FinanzasMockup: FC = () => {
  const { t } = useHomeLiteralT();
  const m = t("s03.mocks.finanzas", { returnObjects: true }) as {
    moduleLabel: string;
    scope: string;
    marginBadge: string;
    kpis: FinKpi[];
    pacingTitle: string;
    pacingDay: string;
    pacingProjects: FinPacing[];
    footerTitle: string;
    footerSub: string;
  };
  const kpis = i18nAsArray<FinKpi>(m.kpis);
  const pacing = i18nAsArray<FinPacing>(m.pacingProjects);

  return (
    <LandingBrowserFrame accent="rgb(16, 185, 129)" activeNav={LANDING_BROWSER_NAV.finance}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">{m.moduleLabel}</div>
          <div className="text-[14px] font-semibold text-slate-900 mt-0.5">{m.scope}</div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100">
          <ChartLine className="h-2.5 w-2.5 text-emerald-700" />
          <span className="font-mono text-[10px] text-emerald-700">{m.marginBadge}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {kpis.map((k, i) => (
          <div key={i} className="rounded-lg p-2.5" style={landingInlineStyle(`background: ${k.bg};`)}>
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">{k.label}</div>
            <div
              className="text-[18px] font-semibold tabular-nums -tracking-[0.02em] mt-0.5"
              style={landingInlineStyle(`color: ${k.color};`)}
            >
              {k.value}
            </div>
            <div className="font-mono text-[9px] text-slate-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">{m.pacingTitle}</span>
          <span className="font-mono text-[9px] text-slate-400">{m.pacingDay}</span>
        </div>
        <div className="space-y-1.5">
          {pacing.map((p, i) => (
            <div key={i} className="grid grid-cols-[80px_1fr_50px] gap-2 items-center">
              <span className="text-[11px] text-slate-700 truncate">{p.name}</span>
              <div className="relative h-3 rounded-md bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-md"
                  style={landingInlineStyle(`background: ${p.color}; width: ${p.pct}%;`)}
                />
                <div
                  aria-hidden
                  className="absolute top-0 bottom-0 w-px bg-slate-300/70"
                  style={landingInlineStyle(`left: ${p.target}%;`)}
                />
              </div>
              <span
                className="font-mono text-[10px] tabular-nums text-right"
                style={landingInlineStyle(`color: ${p.color};`)}
              >
                {p.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg p-2.5 bg-emerald-50/70 border border-emerald-100 flex items-start gap-2">
        <Sparkles className="h-3 w-3 text-emerald-700 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-emerald-900 leading-snug">{m.footerTitle}</div>
          <div className="font-mono text-[10px] text-emerald-700/80 mt-0.5">{m.footerSub}</div>
        </div>
      </div>
    </LandingBrowserFrame>
  );
};

/* ─────────────────────── Config de roles ────────────────────── */

type RoleCopy = {
  label: string;
  badgeText: string;
  heading: string;
  description: string;
  bullets: string[];
  linkText: string;
  linkHref: string;
};

const ROLE_SHELLS: Pick<Role, "color" | "icon" | "Mockup">[] = [
  { color: "rgb(99, 102, 241)", icon: CalendarRange, Mockup: DirectoresMockup },
  { color: "rgb(139, 92, 246)", icon: LayoutDashboard, Mockup: EmpleadosMockup },
  { color: "rgb(245, 158, 11)", icon: Target, Mockup: ProjectManagersMockup },
  { color: "rgb(8, 145, 178)", icon: Users, Mockup: RRHHMockup },
  { color: "rgb(16, 185, 129)", icon: ChartLine, Mockup: FinanzasMockup },
];

const AUTOCYCLE_MS = 5500;
const PAUSE_AFTER_INTERACTION_MS = 12000;

/* ─────────────────────── Componente principal ────────────────────── */

export const LandingBelowSection03: FC = () => {
  const { t, path } = useHomeLiteralT();
  const roleCopies = i18nAsArray<RoleCopy>(t("s03.roles", { returnObjects: true }));
  const roles = useMemo<Role[]>(
    () =>
      roleCopies.map((copy, i) => {
        const shell = ROLE_SHELLS[i];
        if (!shell) throw new Error(`Missing role shell at index ${i}`);
        const bullets = copy.bullets;
        return {
          ...shell,
          label: copy.label,
          badgeText: copy.badgeText,
          heading: copy.heading,
          description: copy.description,
          bullets: [bullets[0] ?? "", bullets[1] ?? "", bullets[2] ?? ""] as [string, string, string],
          linkText: copy.linkText,
          linkHref: path(copy.linkHref),
        };
      }),
    [path, roleCopies],
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const pinnedIdxRef = useRef(0);
  const pausedRef = useRef(false);
  const pauseTimerRef = useRef<number>(0);

  const activate = useCallback((idx: number) => {
    pinnedIdxRef.current = idx;
    pausedRef.current = true;
    setActiveIdx(idx);
    window.clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, PAUSE_AFTER_INTERACTION_MS);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      const next = (pinnedIdxRef.current + 1) % roles.length;
      pinnedIdxRef.current = next;
      setActiveIdx(next);
    }, AUTOCYCLE_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(pauseTimerRef.current);
    };
  }, [roles.length]);

  const role = roles[activeIdx];
  const ActiveMockup = role.Mockup;
  const BadgeIcon = role.icon;

  return (
    <section
      className="relative bg-white overflow-hidden"
      style={landingInlineStyle("padding-top: clamp(5rem, 10vw, 8rem); padding-bottom: clamp(7rem, 12vw, 10rem);")}
    >
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        {/* Encabezado */}
        <div className="max-w-3xl mb-12 text-center mx-auto">
          <span className="inline-block font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400 mb-3">
            {t("s03.kicker")}
          </span>
          <h2 className="text-[2rem] sm:text-4xl lg:text-5xl font-semibold text-slate-900 leading-[1.1] -tracking-[0.02em] mb-5">
            {t("s03.title")} <span className="text-violet-600">{t("s03.titleHighlight")}</span>.
          </h2>
          <p className="text-[15px] sm:text-[16px] text-slate-500 leading-relaxed">{t("s03.subtitle")}</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5 mb-10 sm:mb-14 relative">
          {roles.map((r, i) => {
            const isActive = activeIdx === i;
            const Icon = r.icon;
            return (
              <button
                key={r.label}
                type="button"
                aria-pressed={isActive}
                onMouseEnter={() => activate(i)}
                onFocus={() => activate(i)}
                onClick={(e) => {
                  e.preventDefault();
                  activate(i);
                }}
                className={cn(
                  "relative inline-flex items-center gap-2 h-11 px-4 sm:px-5 rounded-full text-[13px] sm:text-[14px] font-medium transition-colors duration-200",
                  isActive ? "text-white" : "text-slate-700 hover:text-slate-900",
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="section-03-tabs-pill"
                    className="absolute inset-0 rounded-full"
                    style={landingInlineStyle(`background: ${r.color}; box-shadow: ${r.color} 0px 8px 24px -10px; z-index: 0;`)}
                    transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.85 }}
                  />
                ) : null}
                <Icon className="relative h-4 w-4" />
                <span className="relative whitespace-nowrap">{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-100 bg-gradient-to-br from-slate-50/80 to-white">
          <div
            aria-hidden
            className="absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl opacity-25 pointer-events-none transition-[background] duration-300"
            style={landingInlineStyle(`background: radial-gradient(circle, ${role.color}, transparent 70%);`)}
          />
          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 p-8 sm:p-10 lg:p-14">
            {/* Columna izquierda */}
            <div className="lg:col-span-6 relative">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 transition-colors duration-300"
                style={landingInlineStyle(
                  `background: ${rgba(role.color, 0.08)}; border: 1px solid ${rgba(role.color, 0.145)};`,
                )}
              >
                <BadgeIcon className="h-3.5 w-3.5" />
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.2em]"
                  style={landingInlineStyle(`color: ${role.color};`)}
                >
                  {role.badgeText}
                </span>
              </div>
              <motion.div
                key={`heading-${activeIdx}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <h3 className="text-[1.75rem] sm:text-3xl lg:text-4xl font-semibold text-slate-900 leading-[1.15] -tracking-[0.02em] mb-4">
                  {role.heading}
                </h3>
                <p className="text-[15px] sm:text-[16px] text-slate-600 leading-relaxed mb-7">
                  {role.description}
                </p>
                <ul className="space-y-3 mb-8">
                  {role.bullets.map((b, bi) => (
                    <li key={bi} className="flex items-start gap-3 text-[14px] text-slate-700">
                      <span
                        className="mt-1 inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0"
                        style={landingInlineStyle(`background: ${rgba(role.color, 0.12)};`)}
                      >
                        <Check
                          className="h-2.5 w-2.5"
                          strokeWidth={3}
                          style={landingInlineStyle(`color: ${role.color};`)}
                        />
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <a
                  className="group inline-flex items-center gap-1.5 text-[14px] font-medium border-b pb-0.5 transition-colors"
                  href={role.linkHref}
                  style={landingInlineStyle(
                    `color: ${role.color}; border-color: ${rgba(role.color, 0.4)};`,
                  )}
                >
                  {role.linkText}
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </motion.div>
            </div>

            {/* Columna derecha (mockup) */}
            <div className="lg:col-span-6 relative flex items-center justify-center min-h-[420px] lg:min-h-[520px]">
              <motion.div
                key={`mockup-${activeIdx}`}
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
              >
                <ActiveMockup />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
