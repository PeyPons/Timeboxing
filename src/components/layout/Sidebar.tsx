import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  FileBarChart, 
  Settings, 
  LogOut,
  Megaphone,
  Facebook,
  Home 
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const { currentUser } = useApp();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const menuItems = [
    {
      label: "Mi Espacio",
      icon: Home,
      href: "/",
      color: "text-emerald-500"
    },
    {
      label: "Equipo",
      icon: Users,
      href: "/team",
      color: "text-sky-500"
    },
    {
      label: "Proyectos",
      icon: Briefcase,
      href: "/projects",
      color: "text-violet-500"
    },
    {
      label: "Clientes",
      icon: LayoutDashboard,
      href: "/clients",
      color: "text-pink-700"
    },
    {
      label: "Google Ads",
      icon: Megaphone,
      href: "/ads",
      color: "text-orange-500"
    },
    {
      label: "Meta Ads",
      icon: Facebook,
      href: "/meta-ads",
      color: "text-blue-600"
    },
    {
      label: "Reportes",
      icon: FileBarChart,
      href: "/reports",
      color: "text-yellow-500"
    },
    {
      label: "Configuración",
      icon: Settings,
      href: "/settings",
      color: "text-gray-500"
    },
  ];

  return (
    <div className={cn("flex flex-col h-screen border-r bg-white pt-6", className)}>
      {/* Header / Logo */}
      <div className="px-6 pb-6">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
            TB
          </div>
          Timeboxing
        </h2>
      </div>

      {/* Navegación (Diseño Clásico sin Botones) */}
      <div className="flex-1 overflow-y-auto py-2">
        <nav className="grid gap-1 px-3">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-slate-100 text-slate-900" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon className={cn("h-4 w-4 transition-colors", isActive ? item.color : "text-slate-400 group-hover:text-slate-500")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      
      {/* Footer: Perfil de Usuario Real */}
      <div className="mt-auto border-t bg-slate-50 p-4">
        {currentUser ? (
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-9 w-9 border border-white shadow-sm">
              <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
              <AvatarFallback className="bg-indigo-600 text-white font-medium">
                {currentUser.first_name?.[0]}{currentUser.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
               <span className="text-sm font-semibold text-slate-900 truncate">
                 {currentUser.first_name} {currentUser.last_name}
               </span>
               <span className="text-xs text-slate-500 truncate" title={currentUser.email}>
                 {currentUser.email}
               </span>
            </div>
          </div>
        ) : (
          /* Fallback por si acaso tarda en cargar */
          <div className="flex items-center gap-3 mb-3 opacity-50">
             <div className="h-9 w-9 rounded-full bg-slate-200" />
             <div className="space-y-1">
                <div className="h-3 w-20 bg-slate-200 rounded" />
                <div className="h-2 w-24 bg-slate-200 rounded" />
             </div>
          </div>
        )}

        <button 
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
