import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
    <div className={cn("pb-12 h-screen border-r bg-slate-50/50 pt-6 flex flex-col", className)}>
      <div className="space-y-4 py-4 flex-1">
        <div className="px-6 py-2">
          <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              TB
            </div>
            Timeboxing
          </h2>
        </div>
        <div className="px-3 py-2">
          <div className="space-y-1">
            {menuItems.map((item) => (
              <Button
                key={item.href}
                variant={location.pathname === item.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 mb-1 font-normal",
                  location.pathname === item.href && "bg-white shadow-sm border border-slate-200 font-medium"
                )}
                asChild
              >
                <Link to={item.href}>
                  <item.icon className={cn("h-4 w-4", item.color)} />
                  {item.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Footer: Perfil de Usuario + Logout */}
      <div className="p-4 border-t bg-white/50">
        {currentUser && (
          <div className="flex items-center gap-3 mb-4 px-2">
            <Avatar className="h-9 w-9 border">
              <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
              <AvatarFallback className="bg-indigo-100 text-indigo-700">
                {currentUser.first_name?.[0]}{currentUser.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
               <span className="text-sm font-medium text-slate-900 truncate">{currentUser.name}</span>
               <span className="text-xs text-slate-500 truncate">{currentUser.role}</span>
            </div>
          </div>
        )}

        <Button 
          variant="outline" 
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}
