import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useApp } from '@/contexts/AppContext'; // Importamos contexto para datos reales
import { usePermissions } from '@/hooks/usePermissions'; // Hook de permisos
import { supabase } from '@/lib/supabase'; // Para el logout
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  BarChart3, 
  FolderKanban,
  Settings,
  Megaphone, 
  Sparkles,
  Facebook,
  FileDown,
  LogOut,
  Home,
  Calendar
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Sidebar() {
  const location = useLocation();
  const { currentUser } = useApp(); // Obtenemos el usuario real
  const { canAccess } = usePermissions(); // Verificamos permisos

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
        
        {/* Enlace directo al Dashboard personal - Siempre visible */}
        <NavLink to="/" icon={Home} active={location.pathname === '/'}>
          Mi Espacio
        </NavLink>

        {/* Deadline - Verificar permiso */}
        {canAccess('/deadlines') && (
          <NavLink to="/deadlines" icon={Calendar} active={location.pathname === '/deadlines'}>
            Deadline
          </NavLink>
        )}

        {/* Sección Gestión - Solo mostrar si tiene al menos un permiso */}
        {(canAccess('/planner') || canAccess('/projects') || canAccess('/clients') || canAccess('/team')) && (
          <>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-2">
              Gestión
            </div>
            
            {canAccess('/planner') && (
              <NavLink to="/planner" icon={LayoutDashboard} active={location.pathname === '/planner'}>
                Planificador
              </NavLink>
            )}

            {canAccess('/projects') && (
              <NavLink to="/projects" icon={FolderKanban} active={location.pathname === '/projects'}>
                Proyectos
              </NavLink>
            )}

            {canAccess('/clients') && (
              <NavLink to="/clients" icon={Briefcase} active={location.pathname === '/clients'}>
                Clientes
              </NavLink>
            )}

            {canAccess('/team') && (
              <NavLink to="/team" icon={Users} active={location.pathname === '/team'}>
                Equipo
              </NavLink>
            )}
          </>
        )}

        {/* Sección PPC - Solo mostrar si tiene al menos un permiso */}
        {(canAccess('/ads') || canAccess('/meta-ads') || canAccess('/ads-reports')) && (
          <>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-8 mb-2 px-2">
              PPC
            </div>
            
            {canAccess('/ads') && (
              <NavLink to="/ads" icon={Megaphone} active={location.pathname === '/ads'}>
                Google Ads
              </NavLink>
            )}

            {canAccess('/meta-ads') && (
              <NavLink to="/meta-ads" icon={Facebook} active={location.pathname === '/meta-ads'}>
                Meta Ads
              </NavLink>
            )}

            {canAccess('/ads-reports') && (
              <NavLink to="/ads-reports" icon={FileDown} active={location.pathname === '/ads-reports'}>
                Informes automatizados
              </NavLink>
            )}
          </>
        )}

        {/* Sección Análisis - Solo mostrar si tiene al menos un permiso */}
        {(canAccess('/reports') || canAccess('/informes-clientes')) && (
          <>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-8 mb-2 px-2">
              Análisis
            </div>

            {canAccess('/reports') && (
              <NavLink to="/reports" icon={BarChart3} active={location.pathname === '/reports'}>
                Reportes
              </NavLink>
            )}

            {canAccess('/informes-clientes') && (
              <NavLink to="/informes-clientes" icon={FileDown} active={location.pathname === '/informes-clientes'}>
                <span className="truncate">Informes clientes</span>
              </NavLink>
            )}
          </>
        )}

        <NavLink to="/dashboard-ai" icon={Sparkles} active={location.pathname === '/dashboard-ai'}>
          Copiloto IA
        </NavLink>
      </nav>

      {/* Footer del Sidebar: Usuario Real + Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
        <NavLink to="/settings" icon={Settings} active={location.pathname === '/settings'}>
          Configuración
        </NavLink>
        
        {currentUser ? (
          <div className="mt-4 px-2 flex items-center gap-3 group">
            <Avatar className="h-8 w-8 border border-indigo-500/30">
              <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
              <AvatarFallback className="bg-indigo-600 text-white font-medium text-xs">
                {currentUser.first_name?.[0]}{currentUser.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 overflow-hidden min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate" title={currentUser.name}>
                {currentUser.first_name || currentUser.name}
              </p>
              <p className="text-xs text-slate-500 truncate" title={currentUser.email}>
                {currentUser.email}
              </p>
            </div>

            <button 
              onClick={handleLogout}
              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-md transition-colors opacity-0 group-hover:opacity-100"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* Estado de carga discreto */
          <div className="mt-4 px-2 flex items-center gap-3 opacity-50">
             <div className="h-8 w-8 rounded-full bg-slate-800 animate-pulse" />
             <div className="space-y-1">
                <div className="h-2 w-20 bg-slate-800 rounded animate-pulse" />
                <div className="h-2 w-16 bg-slate-800 rounded animate-pulse" />
             </div>
          </div>
        )}
      </div>
    </aside>
  );
}
