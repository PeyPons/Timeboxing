import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Allocation } from '@/types';
import { format, addDays, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface AllocationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  allocationToEdit?: Allocation;
  defaultEmployeeId?: string;
  defaultWeek?: string;
}

export default function AllocationSheet({ 
  isOpen, 
  onClose, 
  allocationToEdit, 
  defaultEmployeeId, 
  defaultWeek 
}: AllocationSheetProps) {
  const { employees, projects, addAllocation, updateAllocation, removeAllocation, currentDate } = useApp();
  
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId || '');
  const [projectId, setProjectId] = useState('');
  const [hours, setHours] = useState('0');
  const [selectedWeek, setSelectedWeek] = useState(defaultWeek || '');
  const [taskName, setTaskName] = useState(''); // Estado para el nombre de la tarea

  // Generar semanas del mes actual para el desplegable
  const generateWeeks = () => {
    const weeks = [];
    // Asumimos que queremos mostrar las semanas relevantes al mes actual del contexto
    // Tomamos el primer día del mes actual
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    // Encontramos el inicio de la semana de ese primer día (Lunes)
    let currentWeekStart = startOfWeek(startOfMonth, { weekStartsOn: 1 });
    
    // Generamos 5 o 6 semanas
    for (let i = 0; i < 6; i++) {
        weeks.push(currentWeekStart);
        currentWeekStart = addDays(currentWeekStart, 7);
    }
    return weeks;
  };

  const weeks = generateWeeks();

  useEffect(() => {
    if (isOpen) {
      if (allocationToEdit) {
        setEmployeeId(allocationToEdit.employeeId);
        setProjectId(allocationToEdit.projectId);
        setHours(allocationToEdit.hoursAssigned.toString());
        setSelectedWeek(allocationToEdit.weekStartDate);
        setTaskName(allocationToEdit.taskName || ''); // Cargar nombre si existe
      } else {
        setEmployeeId(defaultEmployeeId || '');
        setProjectId('');
        setHours('0');
        setSelectedWeek(defaultWeek || (weeks[0] ? format(weeks[0], 'yyyy-MM-dd') : ''));
        setTaskName(''); // Resetear nombre
      }
    }
  }, [isOpen, allocationToEdit, defaultEmployeeId, defaultWeek]);

  const handleSave = () => {
    const hoursNum = parseFloat(hours);
    if (!employeeId || !projectId || !selectedWeek || isNaN(hoursNum)) return;

    if (allocationToEdit) {
      updateAllocation({
        ...allocationToEdit,
        employeeId,
        projectId,
        weekStartDate: selectedWeek,
        hoursAssigned: hoursNum,
        taskName: taskName // Guardar nombre
      });
    } else {
      addAllocation({
        employeeId,
        projectId,
        weekStartDate: selectedWeek,
        hoursAssigned: hoursNum,
        taskName: taskName // Guardar nombre
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (allocationToEdit) {
      removeAllocation(allocationToEdit.id);
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>{allocationToEdit ? 'Editar Tarea' : 'Nueva Tarea'}</SheetTitle>
          <SheetDescription>
            Asigna horas a un proyecto específico para esta semana.
          </SheetDescription>
        </SheetHeader>
        
        <div className="grid gap-4 py-4">
          {/* Nombre de la Tarea (NUEVO) */}
          <div className="grid gap-2">
            <Label htmlFor="taskName">Nombre de la Tarea</Label>
            <Input 
              id="taskName"
              placeholder="Ej: Diseño de Home, Maquetación..." 
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="employee">Empleado</Label>
            <Select onValueChange={setEmployeeId} value={employeeId}>
              <SelectTrigger id="employee">
                <SelectValue placeholder="Selecciona empleado" />
              </SelectTrigger>
              <SelectContent>
                {employees.filter(e => e.isActive).map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project">Proyecto</Label>
            <Select onValueChange={setProjectId} value={projectId}>
              <SelectTrigger id="project">
                <SelectValue placeholder="Selecciona proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects.filter(p => p.status === 'active').map(proj => (
                  <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="week">Semana</Label>
              <Select onValueChange={setSelectedWeek} value={selectedWeek}>
                <SelectTrigger id="week">
                  <SelectValue placeholder="Semana" />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map((weekStart, index) => {
                    // Lógica visual mejorada para las semanas
                    const start = weekStart;
                    const end = addDays(start, 4); // Mostramos Lun-Vie
                    const label = `Sem ${index + 1} (${format(start, 'd', { locale: es })}-${format(end, 'd MMM', { locale: es })})`;
                    
                    return (
                        <SelectItem key={format(weekStart, 'yyyy-MM-dd')} value={format(weekStart, 'yyyy-MM-dd')}>
                        {label}
                        </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hours">Horas</Label>
              <Input 
                id="hours" 
                type="number" 
                value={hours} 
                onChange={(e) => setHours(e.target.value)}
                min={0}
                step={0.5}
              />
            </div>
          </div>
        </div>

        <SheetFooter className="flex flex-row justify-between sm:justify-between items-center w-full gap-2">
          {allocationToEdit && (
             <AlertDialog>
             <AlertDialogTrigger asChild>
               <Button variant="destructive" size="icon" className="h-10 w-10">
                 <Trash2 size={18} />
               </Button>
             </AlertDialogTrigger>
             <AlertDialogContent>
               <AlertDialogHeader>
                 <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                 <AlertDialogDescription>
                   Esta acción eliminará permanentemente esta asignación de horas.
                 </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                 <AlertDialogCancel>Cancelar</AlertDialogCancel>
                 <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
               </AlertDialogFooter>
             </AlertDialogContent>
           </AlertDialog>
          )}
          
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
