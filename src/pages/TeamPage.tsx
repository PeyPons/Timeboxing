import { useApp } from '@/contexts/AppContext';
import { EmployeeCard } from '@/components/team/EmployeeCard';
import { Users } from 'lucide-react';

export default function TeamPage() {
  const { employees } = useApp();

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Equipo</h1>
            <p className="text-muted-foreground">
              Gestiona los horarios y capacidades de tu equipo
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {employees.map((employee) => (
          <EmployeeCard key={employee.id} employee={employee} />
        ))}
      </div>
    </div>
  );
}
