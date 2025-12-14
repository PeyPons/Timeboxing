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
import { WorkSchedule } from '@/types'; // Asegúrate de importar esto

const TeamPage = () => {
  const { employees, addEmployee } = useApp();
  const [showInactive, setShowInactive] = useState(false);
  
  // Estados para el formulario
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  
  // NUEVO: Estado para el horario detallado desde el principio
  const [newSchedule, setNewSchedule] = useState<WorkSchedule>({
    monday: 8,
    tuesday: 8,
    wednesday: 8,
    thursday: 8,
    friday: 8,
    saturday: 0,
    sunday: 0
  });

  const activeEmployees = employees.filter(e => e.isActive);
  const displayedEmployees = showInactive ? employees : activeEmployees;

  // Calcular capacidad total al vuelo
  const totalCapacity = Object.values(newSchedule).reduce((a, b) => a + b, 0);

  const handleCreateEmployee = () => {
    if (!newEmployeeName.trim()) return; // Solo el nombre es obligatorio ahora

    addEmployee({
      name: newEmployeeName,
      role: newEmployeeRole, // Puede ir vacío
      defaultWeeklyCapacity: totalCapacity, // Se calcula sola
      workSchedule: newSchedule, // Se manda el horario detallado
      isActive: true,
      avatarUrl: undefined
    });

    // Resetear formulario
    setNewEmployeeName('');
    setNewEmployeeRole('');
    setNewSchedule({ monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 });
    setIsDialogOpen(false);
  };

  const handleScheduleChange = (day: keyof WorkSchedule, val: string) => {
    setNewSchedule(prev => ({...prev, [day]: Number(val) || 0 }));
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
                <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
                <Label htmlFor="show-inactive" className="text-sm font-medium cursor-pointer">Mostrar inactivos</Label>
              </div>

              {/* DIÁLOGO AÑADIR EMPLEADO */}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 shadow-md hover:shadow-lg transition-all">
                    <UserPlus className="h-4 w-4" />
                    Añadir Empleado
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Nuevo Empleado</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nombre <span className="text-destructive">*</span></Label>
                      <Input
                        id="name"
                        value={newEmployeeName}
                        onChange={(e) => setNewEmployeeName(e.target.value)}
                        placeholder="Ej: Marta García"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="role">Rol / Cargo (Opcional)</Label>
                      <Input
                        id="role"
                        value={newEmployeeRole}
                        onChange={(e) => setNewEmployeeRole(e.target.value)}
                        placeholder="Ej: SEO Specialist"
                      />
                    </div>
                    
                    {/* INPUTS DE HORARIO DESGLOSADO */}
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <Label>Horario Semanal</Label>
                        <span className="text-xs font-bold text-primary">Total: {totalCapacity}h</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => (
                          <div key={day} className="text-center">
                            <Label className="text-[10px] uppercase text-muted-foreground">{day.substring(0,3)}</Label>
                            <Input 
                              type="number" 
                              className="h-9 text-center px-1"
                              value={newSchedule[day as keyof WorkSchedule]}
                              onChange={(e) => handleScheduleChange(day as keyof WorkSchedule, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4 w-1/2 mx-auto">
                         {/* Fines de semana opcionales */}
                         {['saturday', 'sunday'].map((day) => (
                          <div key={day} className="text-center">
                            <Label className="text-[10px] uppercase text-muted-foreground">{day.substring(0,3)}</Label>
                            <Input 
                              type="number" 
                              className="h-9 text-center px-1 bg-muted/30"
                              value={newSchedule[day as keyof WorkSchedule]}
                              onChange={(e) => handleScheduleChange(day as keyof WorkSchedule, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreateEmployee}>Crear Empleado</Button>
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TeamPage;
