import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmployeeCard } from '@/components/team/EmployeeCard';
import { TeamEventManager } from '@/components/team/TeamEventManager';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Helmet } from 'react-helmet-async';

const TeamPage = () => {
  const { employees, addEmployee } = useApp();
  const [showInactive, setShowInactive] = useState(false);
  
  // Estados para el formulario
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [newEmployeeCapacity, setNewEmployeeCapacity] = useState(40);

  const activeEmployees = employees.filter(e => e.isActive);
  const inactiveEmployees = employees.filter(e => !e.isActive);
  
  const displayedEmployees = showInactive ? employees : activeEmployees;

  // Manejar creación
  const handleCreateEmployee = () => {
    if (!newEmployeeName.trim() || !newEmployeeRole.trim()) return;

    addEmployee({
      name: newEmployeeName,
      role: newEmployeeRole,
      defaultWeeklyCapacity: newEmployeeCapacity,
      workSchedule: {
        monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0
      },
      isActive: true,
      avatarUrl: undefined
    });

    setNewEmployeeName('');
    setNewEmployeeRole('');
    setNewEmployeeCapacity(40);
    setIsDialogOpen(false);
  };

  return (
    <>
      <Helmet>
        <title>Equipo | Timeboxing</title>
      </Helmet>
      
      <div className="container mx-auto py-8 px-4 max-w-7xl animate-fade-in">
        <div className="flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                Gestión del Equipo
              </h1>
              <p className="text-muted-foreground mt-1">
                {activeEmployees.length} activos / {employees.length} total
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2 bg-card p-2 rounded-lg border shadow-sm">
                <Switch 
                  id="show-inactive" 
                  checked={showInactive} 
                  onCheckedChange={setShowInactive} 
                />
                <Label htmlFor="show-inactive" className="text-sm font-medium cursor-pointer">
                  Mostrar inactivos
                </Label>
              </div>

              {/* Botón Añadir Empleado */}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 shadow-md hover:shadow-lg transition-all">
                    <UserPlus className="h-4 w-4" />
                    Añadir Empleado
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuevo Empleado</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input
                        id="name"
                        value={newEmployeeName}
                        onChange={(e) => setNewEmployeeName(e.target.value)}
                        placeholder="Ej: Marta García"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="role">Rol / Cargo</Label>
                      <Input
                        id="role"
                        value={newEmployeeRole}
                        onChange={(e) => setNewEmployeeRole(e.target.value)}
                        placeholder="Ej: SEO Specialist"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="capacity">Capacidad Semanal (Horas)</Label>
                      <Input
                        id="capacity"
                        type="number"
                        value={newEmployeeCapacity}
                        onChange={(e) => setNewEmployeeCapacity(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateEmployee}>
                      <Plus className="mr-2 h-4 w-4" />
                      Crear Empleado
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid gap-6">
            <TeamEventManager />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {displayedEmployees.map((employee) => (
                <EmployeeCard key={employee.id} employee={employee} />
              ))}
              
              {/* Tarjeta de añadir rápido */}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <button className="flex flex-col items-center justify-center h-[300px] rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-all gap-4 group">
                    <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-foreground">Añadir nuevo miembro</h3>
                      <p className="text-sm text-muted-foreground">Define rol y capacidad</p>
                    </div>
                  </button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TeamPage;
