import type { FC, ReactNode } from "react";
import {
  Activity,
  Calendar,
  DollarSign,
  Home,
  LayoutDashboard,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { landingInlineStyle } from "@/components/landing/below/landingInlineStyle";
import { useHomeLiteralT } from "@/components/landing/below/useHomeLiteralT";
import { cn } from "@/lib/utils";

const SIDEBAR_NAV: { Icon: LucideIcon; labelKey: string }[] = [
  { Icon: Home, labelKey: "s03.mockNav.home" },
  { Icon: LayoutDashboard, labelKey: "s03.mockNav.planner" },
  { Icon: Calendar, labelKey: "s03.mockNav.deadlines" },
  { Icon: Activity, labelKey: "s03.mockNav.operations" },
  { Icon: DollarSign, labelKey: "s03.mockNav.finance" },
  { Icon: Users, labelKey: "s03.mockNav.capacity" },
];

function rgba(rgb: string, alpha: number): string {
  const m = /^rgb\(([^)]+)\)$/.exec(rgb);
  return m ? `rgba(${m[1]}, ${alpha})` : rgb;
}

type LandingBrowserFrameProps = {
  accent: string;
  children: ReactNode;
  activeNav?: number;
};

/** Marco de producto con mini-sidebar como en la app (sin la «T» genérica). */
export const LandingBrowserFrame: FC<LandingBrowserFrameProps> = ({
  accent,
  children,
  activeNav = 0,
}) => {
  const { t } = useHomeLiteralT();

  return (
    <div className="relative mx-auto w-full max-w-xl" style={landingInlineStyle("perspective: 1400px;")}>
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
        style={landingInlineStyle(
          `transform: rotateY(-5deg) rotateX(2deg); transform-style: preserve-3d; box-shadow: ${rgba(accent, 0.3)} 0px 36px 80px -20px, rgba(15, 23, 42, 0.18) 0px 22px 42px -18px;`,
        )}
      >
        <div className="flex">
          <aside className="hidden w-11 shrink-0 flex-col items-center gap-1.5 border-r border-slate-800 bg-slate-900 py-3 sm:flex">
            <div
              className="mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 shadow-md shadow-violet-900/40"
              title="Taimbox"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-white" strokeWidth={2.25} aria-hidden />
            </div>
            {SIDEBAR_NAV.map(({ Icon, labelKey }, i) => {
              const active = i === activeNav;
              return (
                <div
                  key={labelKey}
                  title={t(labelKey)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    active ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.25 : 2} aria-hidden />
                </div>
              );
            })}
          </aside>
          <div className="relative min-w-0 flex-1 p-4 sm:p-5">{children}</div>
        </div>
      </div>
    </div>
  );
};
