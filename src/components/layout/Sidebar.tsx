import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
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
  FileDown
} from 'lucide-react';

export function Sidebar() {
  const location = useLocation();

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
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
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

      {/* Footer del Sidebar */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
        <NavLink to="/settings" icon={Settings} active={location.pathname === '/settings'}>
          Configuración
        </NavLink>
        
        <div className="mt-4 px-2 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold border border-indigo-500/30">
            AD
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-slate-200 truncate">Admin User</p>
            <p className="text-xs text-slate-500 truncate">admin@agencia.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
