import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmployeeCard } from '@/components/team/EmployeeCard';
import { TeamEventManager } from '@/components/team/TeamEventManager'; // Importamos el componente
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'; // Usaremos Dialog para el popup
import { Plus, Search, CalendarOff } from 'lucide-react';

export default function TeamPage() {
  const { employees, addEmployee } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para añadir empleado rápido
  const [isAddingEmp, setIsAddingEmp] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('');

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddEmployee = async () => {
    if (!newEmpName) return;
    await addEmployee({
        name: newEmpName,
        role: newEmpRole || 'Sin rol',
        defaultWeeklyCapacity: 40,
        workSchedule: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 },
        isActive: true,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newEmpName}`
    });
    setNewEmpName('');
    setNewEmpRole('');
    setIsAddingEmp(false);
  };

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      
      {/* Cabecera Limpia */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Equipo</h1>
            <p className="text-muted-foreground">Gestiona a tus empleados, sus horarios y proyecciones.</p>
        </div>
        
        {/* ✅ BOTÓN DE EVENTOS (POPUP) */}
        <div className="flex gap-2">
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 bg-white dark:bg-slate-900 border-dashed">
                        <CalendarOff className="h-4 w-4 text-orange-500" />
                        Gestionar Festivos
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <TeamEventManager />
                </DialogContent>
            </Dialog>

            <Button onClick={() => setIsAddingEmp(!isAddingEmp)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                <Plus className="h-4 w-4" /> Nuevo Empleado
            </Button>
        </div>
      </div>

      {/* Formulario rápido de empleado (si está activo) */}
      {isAddingEmp && (
        <div className="bg-slate-50 border rounded-lg p-4 flex gap-4 items-end animate-in fade-in slide-in-from-top-2">
            <div className="grid gap-1 flex-1">
                <span className="text-xs font-medium">Nombre</span>
                <Input value={newEmpName} onChange={e => setNewEmpName(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div className="grid gap-1 flex-1">
                <span className="text-xs font-medium">Rol</span>
                <Input value={newEmpRole} onChange={e => setNewEmpRole(e.target.value)} placeholder="Ej: Diseñador Senior" />
            </div>
            <Button onClick={handleAddEmployee}>Guardar</Button>
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o rol..."
          className="pl-9 max-w-sm bg-white dark:bg-slate-950"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid de Empleados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((employee) => (
          <EmployeeCard key={employee.id} employee={employee} />
        ))}
        {filteredEmployees.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
                No se encontraron empleados que coincidan con tu búsqueda.
            </div>
        )}
      </div>
    </div>
  );
}
