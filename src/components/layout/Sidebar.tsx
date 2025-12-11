import { NavLink } from '@/components/NavLink';
import { Calendar, Users, Briefcase, BarChart3, Settings, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Planificador', href: '/', icon: Calendar },
  { name: 'Equipo', href: '/team', icon: Users },
  { name: 'Clientes', href: '/clients', icon: Briefcase },
  { name: 'Proyectos', href: '/projects', icon: Layers },
  { name: 'Reportes', href: '/reports', icon: BarChart3 },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <Calendar className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-sidebar-foreground">ResourceFlow</h1>
          <p className="text-xs text-sidebar-foreground/60">Gestión de Recursos</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/'}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            activeClassName="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground shadow-glow"
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Settings */}
      <div className="border-t border-sidebar-border p-3">
        <NavLink
          to="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
            "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
          activeClassName="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
        >
          <Settings className="h-5 w-5" />
          Configuración
        </NavLink>
      </div>
    </aside>
  );
}
