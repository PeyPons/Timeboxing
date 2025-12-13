import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmployeeCard } from '@/components/team/EmployeeCard';
import { TeamEventManager } from '@/components/team/TeamEventManager';
import { Users, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type FilterType = 'all' | 'active' | 'inactive';

export default function TeamPage() {
  const { employees } = useApp();
  const [filter, setFilter] = useState<FilterType>('all');

  const activeCount = employees.filter(e => e.isActive).length;
  const inactiveCount = employees.filter(e => !e.isActive).length;

  const filteredEmployees = employees.filter(employee => {
    if (filter === 'active') return employee.isActive;
    if (filter === 'inactive') return !employee.isActive;
    return true;
  });

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Equipo</h1>
              <p className="text-muted-foreground">
                Gestiona los horarios y capacidades de tu equipo
              </p>
            </div>
          </div>
          
          {/* Summary badges */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1">
              <UserCheck className="h-3.5 w-3.5 text-success" />
              <span>{activeCount} activos</span>
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1">
              <UserX className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{inactiveCount} inactivos</span>
            </Badge>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Todos ({employees.length})
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('active')}
          >
            Activos ({activeCount})
          </Button>
          <Button
            variant={filter === 'inactive' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('inactive')}
          >
            Inactivos ({inactiveCount})
          </Button>
        </div>
      </div>

      {/* Team Events Section */}
      <div className="mb-8 p-4 rounded-lg border bg-card">
        <TeamEventManager />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredEmployees.map((employee) => (
          <EmployeeCard key={employee.id} employee={employee} />
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No hay empleados {filter === 'active' ? 'activos' : filter === 'inactive' ? 'inactivos' : ''}
        </div>
      )}
    </div>
  );
}
