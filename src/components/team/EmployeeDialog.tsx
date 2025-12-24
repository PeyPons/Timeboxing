import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Employee } from '@/types';
import { useApp } from '@/contexts/AppContext';

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeToEdit?: Employee | null; // Si es null, estamos creando
}

export function EmployeeDialog({ open, onOpenChange, employeeToEdit }: EmployeeDialogProps) {
  const { addEmployee, updateEmployee } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('Development');
  const [capacity, setCapacity] = useState(40);
  const [hourlyRate, setHourlyRate] = useState(0);

  // Cargar datos al abrir para editar
  useEffect(() => {
    if (open) {
      if (employeeToEdit) {
        setName(employeeToEdit.name);
        setEmail(employeeToEdit.email || '');
        setRole(employeeToEdit.role);
        setDepartment(employeeToEdit.department || 'Development');
        setCapacity(employeeToEdit.defaultWeeklyCapacity);
        setHourlyRate(employeeToEdit.hourlyRate || 0);
      } else {
        // Reset para nuevo empleado
        setName('');
        setEmail('');
        setRole('');
        setDepartment('Development');
        setCapacity(40);
        setHourlyRate(0);
      }
    }
  }, [open, employeeToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Construimos el objeto base
    const employeeData = {
      name,
      email: email.trim() || undefined, // Guardamos el email para el login
      role,
      department,
      defaultWeeklyCapacity: Number(capacity),
      hourlyRate: Number(hourlyRate),
      workSchedule: { // Horario por defecto
        monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0
      },
      isActive: true,
      avatarUrl: employeeToEdit?.avatarUrl // Mantenemos avatar si existe
    };

    try {
      if (employeeToEdit) {
        await updateEmployee({ ...employeeToEdit, ...employeeData });
      } else {
        await addEmployee(employeeData);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error guardando empleado:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{employeeToEdit ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
          <DialogDescription>
            {employeeToEdit 
              ? 'Modifica los datos del miembro del equipo.' 
              : 'Añade un nuevo miembro a tu equipo.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre Completo</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="email">Email (Login Supabase)</Label>
            <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="usuario@agencia.com"
            />
            <p className="text-[11px] text-muted-foreground">
                Este email vinculará al usuario con su cuenta de login.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
                <Label htmlFor="role">Rol</Label>
                <Input id="role" value={role} onChange={e => setRole(e.target.value)} placeholder="Ej: Senior Dev" required />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="dept">Departamento</Label>
                <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Development">Desarrollo</SelectItem>
                        <SelectItem value="Design">Diseño</SelectItem>
                        <SelectItem value="Management">Gestión</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
                <Label htmlFor="capacity">Capacidad Semanal (h)</Label>
                <Input id="capacity" type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="rate">Coste/Hora (€)</Label>
                <Input id="rate" type="number" value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit">{employeeToEdit ? 'Guardar Cambios' : 'Crear Empleado'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
