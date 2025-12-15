import { useState, useMemo, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useReactToPrint } from 'react-to-print';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileDown, CalendarDays, Printer } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Función helper para redondeo
const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export default function ClientReportsPage() {
  const { projects, clients, allocations } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // Referencia para la impresión
  const componentRef = useRef<HTMLDivElement>(null);

  // Configuración de impresión
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `Informe_Horas_Clientes_${format(selectedMonth, 'MMMM_yyyy', { locale: es })}`,
  });

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // --- LÓGICA DE DATOS (Crucial) ---
  const reportData = useMemo(() => {
    // 1. Filtramos proyectos activos (o que tuvieron actividad)
    const activeProjects = projects.filter(p => p.status === 'active');

    return activeProjects.map(project => {
        const client = clients.find(c => c.id === project.clientId);
        
        // 2. Buscamos asignaciones de este proyecto en el mes seleccionado
        const projectAllocations = allocations.filter(a => {
            const date = parseISO(a.weekStartDate);
            return a.projectId === project.id && date >= monthStart && date <= monthEnd;
        });

        // 3. Calculamos COMPUTADO (Solo tareas completadas)
        // Usamos la lógica: Si tiene hoursActual, usa eso. Si no, usa hoursAssigned.
        const computedHours = projectAllocations
            .filter(a => a.status === 'completed')
            .reduce((sum, a) => sum + (a.hoursActual || a.hoursAssigned), 0);

        const budget = project.budgetHours || 0;
        const minimum = project.minimumHours || 0;
        
        // Progreso (Computado / Contratado)
        const progress = budget > 0 ? (computedHours / budget) * 100 : 0;

        return {
            id: project.id,
            project: project.name,
            client: client?.name || 'Sin Cliente',
            progress: round2(progress),
            contracted: round2(budget),
            computed: round2(computedHours),
            minimum: round2(minimum),
            status: project.healthStatus // Para colorear si quieres
        };
    }).filter(row => row.contracted > 0 || row.computed > 0) // Ocultar proyectos vacíos
      .sort((a, b) => b.progress - a.progress); // Ordenar por mayor progreso
  }, [projects, clients, allocations, monthStart, monthEnd]);

  // Generar lista de los últimos 12 meses para el selector
  const monthsList = Array.from({ length: 12 }, (_, i) => subMonths(new Date(), i));

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
      
      {/* Cabecera de Control (No sale en el PDF) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <FileDown className="h-8 w-8 text-indigo-600" />
                Informes de Clientes
            </h1>
            <p className="text-muted-foreground">
                Genera el resumen mensual de horas para enviar a clientes.
            </p>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm">
            <Select 
                value={selectedMonth.toISOString()} 
                onValueChange={(val) => setSelectedMonth(new Date(val))}
            >
                <SelectTrigger className="w-[200px]">
                    <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {monthsList.map(date => (
                        <SelectItem key={date.toISOString()} value={date.toISOString()}>
                            {format(date, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(date, 'MMMM yyyy', { locale: es }).slice(1)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <div className="h-6 w-px bg-slate-200" />

            <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <Printer className="h-4 w-4" />
                Imprimir / PDF
            </Button>
        </div>
      </div>

      {/* --- ÁREA IMPRIMIBLE (DOCUMENTO A4) --- */}
      <div className="flex-1 overflow-auto bg-slate-100/50 p-4 md:p-8 flex justify-center">
        <div ref={componentRef} className="bg-white shadow-2xl w-full max-w-[210mm] min-h-[297mm] p-[15mm] print:shadow-none print:w-full print:max-w-none print:p-0">
            
            {/* Cabecera del Informe */}
            <div className="flex justify-between items-end border-b-2 border-indigo-600 pb-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-wide">Informe de Horas</h2>
                    <p className="text-sm text-slate-500 mt-1">Resumen de actividad y computación</p>
                </div>
                <div className="text-right">
                    <div className="text-sm font-semibold text-indigo-600 uppercase">Periodo</div>
                    <div className="text-xl font-bold text-slate-800 capitalize">
                        {format(selectedMonth, 'MMMM yyyy', { locale: es })}
                    </div>
                </div>
            </div>

            {/* Tabla de Datos */}
            <div className="rounded-md border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="font-bold text-slate-700 w-[25%]">PROYECTO</TableHead>
                            <TableHead className="font-bold text-slate-700 w-[20%]">CLIENTE</TableHead>
                            <TableHead className="font-bold text-slate-700 text-center">PROGRESO</TableHead>
                            <TableHead className="font-bold text-slate-700 text-right">H. CONTRATADAS</TableHead>
                            <TableHead className="font-bold text-slate-700 text-right">H. COMP</TableHead>
                            <TableHead className="font-bold text-slate-700 text-right">H. MÍNIMAS</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportData.map((row) => (
                            <TableRow key={row.id} className="hover:bg-slate-50/50">
                                <TableCell className="font-medium text-slate-800">
                                    {row.project}
                                </TableCell>
                                <TableCell className="text-slate-500 text-xs uppercase">
                                    {row.client}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline" className={cn(
                                        "font-mono font-bold",
                                        row.progress > 100 ? "bg-red-50 text-red-700 border-red-200" :
                                        row.progress > 85 ? "bg-amber-50 text-amber-700 border-amber-200" :
                                        "bg-green-50 text-green-700 border-green-200"
                                    )}>
                                        {row.progress.toFixed(0)}%
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-600">
                                    {row.contracted.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-slate-900 bg-slate-50">
                                    {row.computed.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-400">
                                    {row.minimum > 0 ? row.minimum.toFixed(2) : '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pie de página del informe */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between text-[10px] text-slate-400">
                <span>Generado automáticamente por Timeboxing App</span>
                <span>{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
            </div>

        </div>
      </div>
    </div>
  );
}
