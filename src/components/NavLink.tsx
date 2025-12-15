import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  to: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}

export function NavLink({ to, icon: Icon, children, active, className }: NavLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium group",
        active 
          ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
        className
      )}
    >
      {Icon && (
        <Icon 
          className={cn(
            "h-4 w-4 transition-colors",
            active ? "text-white" : "text-slate-500 group-hover:text-slate-300"
          )} 
        />
      )}
      <span>{children}</span>
    </Link>
  );
}
