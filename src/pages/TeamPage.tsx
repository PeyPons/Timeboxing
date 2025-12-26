import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmployeeCard } from '@/components/team/EmployeeCard';
import { TeamEventManager } from '@/components/team/TeamEventManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, CalendarOff, UserPlus } from 'lucide-react';
import { EmployeeDialog } from '@/components/team/EmployeeDialog'; // Importamos el diálogo completo
import { Employee } from '@/types';

export default function TeamPage() {
  const { employees } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para el diálogo de edición/creación completo
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditEmployee = (employee: Employee) => {
      setSelectedEmployee(employee);
      setDialogOpen(true);
  };

  const handleNewEmployee = () => {
      setSelectedEmployee(null);
      setDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Equipo</h1>
            <p className="text-muted-foreground">Gestiona empleados, accesos y horarios.</p>
        </div>
        
        <div className="flex gap-2">
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 bg-white border-dashed">
                        <CalendarOff className="h-4 w-4 text-orange-500" />
                        Festivos
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <TeamEventManager />
                </DialogContent>
            </Dialog>

            <Button onClick={handleNewEmployee} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                <Plus className="h-4 w-4" /> Nuevo empleado
            </Button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative mt-2">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por nombre o rol..."
          className="pl-9 max-w-sm bg-white border-slate-200"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid de Empleados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {filteredEmployees.map((employee) => (
          // Pasamos onClick para abrir el modo edición
          <div key={employee.id} onClick={() => handleEditEmployee(employee)} className="cursor-pointer transition-transform hover:scale-[1.01]">
             {/* Asegúrate de que EmployeeCard no tenga botones que capturen el click, o pasa onEdit explícitamente si lo prefieres */}
             <EmployeeCard employee={employee} />
          </div>
        ))}
        
        {filteredEmployees.length === 0 && (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-slate-500">No se encontraron empleados.</p>
            </div>
        )}
      </div>

      {/* Diálogo Centralizado */}
      <EmployeeDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        employeeToEdit={selectedEmployee} 
      />
    </div>
  );
}
