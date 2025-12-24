import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useApp } from "@/contexts/AppContext"; // Importamos el contexto para datos reales
import { supabase } from "@/lib/supabase"; // Para cerrar sesión
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  BarChart3, 
  FolderKanban,
  Settings,
  Megaphone, 
  Sparkles,
  FileStack,
  Facebook,
  FileDown,
  LogOut,
  Home
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Sidebar() {
  const location = useLocation();
  const { currentUser } = useApp(); // Obtenemos el usuario logueado

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800 z-50">
      
      {/* Header del Sidebar */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <span className="text-slate-100">Timeboxing</span>
        </div>
      </div>

      {/* Navegación Principal */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <NavLink to="/" icon={Home} active={location.pathname === '/'}>
          Mi Espacio
        </NavLink>

        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-2">
          Gestión
        </div>
        
        <NavLink to="/planner" icon={LayoutDashboard} active={location.pathname === '/planner'}>
          Planificador
        </NavLink>

        <NavLink to="/projects" icon={FolderKanban} active={location.pathname === '/projects'}>
          Proyectos
        </NavLink>

        <NavLink to="/clients" icon={Briefcase} active={location.pathname === '/clients'}>
          Clientes
        </NavLink>

        <NavLink to="/team" icon={Users} active={location.pathname === '/team'}>
          Equipo
        </NavLink>

        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-8 mb-2 px-2">
          PPC
        </div>
        
        <NavLink to="/ads" icon={Megaphone} active={location.pathname === '/ads'}>
          Google Ads
        </NavLink>

        <NavLink to="/meta-ads" icon={Facebook} active={location.pathname === '/meta-ads'}>
          Meta Ads
        </NavLink>

        <NavLink to="/ads-reports" icon={FileDown} active={location.pathname === '/ads-reports'}>
          Informes automatizados
        </NavLink>

        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-8 mb-2 px-2">
          Análisis
        </div>

        <NavLink to="/reports" icon={BarChart3} active={location.pathname === '/reports'}>
          Reportes
        </NavLink>

        <NavLink to="/informes-clientes" icon={FileDown} active={location.pathname === '/informes-clientes'}>
          <span className="truncate">Informes Clientes</span>
        </NavLink>

        <NavLink to="/dashboard-ai" icon={Sparkles} active={location.pathname === '/dashboard-ai'}>
          Copiloto IA
        </NavLink>
      </nav>

      {/* Footer del Sidebar con Usuario Real */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
        <NavLink to="/settings" icon={Settings} active={location.pathname === '/settings'}>
          Configuración
        </NavLink>
        
        {currentUser ? (
          <div className="mt-4 px-2 flex items-center gap-3 group relative">
            <Avatar className="h-9 w-9 border border-indigo-500/30">
              <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
              <AvatarFallback className="bg-indigo-600 text-white font-medium text-xs">
                {currentUser.first_name?.[0]}{currentUser.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 overflow-hidden min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate" title={currentUser.name}>
                {currentUser.first_name} {currentUser.last_name}
              </p>
              <p className="text-xs text-slate-500 truncate" title={currentUser.email}>
                {currentUser.email}
              </p>
            </div>
            
            {/* Botón de Logout discreto */}
            <button 
              onClick={handleLogout}
              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-md transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* Estado de carga o fallback */
          <div className="mt-4 px-2 flex items-center gap-3 opacity-50">
             <div className="h-9 w-9 rounded-full bg-slate-800 animate-pulse" />
             <div className="space-y-1">
                <div className="h-3 w-20 bg-slate-800 rounded animate-pulse" />
                <div className="h-2 w-24 bg-slate-800 rounded animate-pulse" />
             </div>
          </div>
        )}
      </div>
    </aside>
  );
}
