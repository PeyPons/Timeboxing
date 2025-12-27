import { useState, useMemo, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useReactToPrint } from 'react-to-print';
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

  // Configuración de impresión (CORREGIDA PARA LA VERSIÓN NUEVA)
  const handlePrint = useReactToPrint({
    contentRef: componentRef, // ✅ CAMBIO CLAVE: Usamos contentRef en lugar de content
    documentTitle: `Informe_Horas_${format(selectedMonth, 'MMMM_yyyy', { locale: es })}`,
    pageStyle: `
      @page {
        size: A4 landscape;
        margin: 20mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
        }
      }
    `
  });

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // --- LÓGICA DE DATOS ---
  const reportData = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === 'active');

    return activeProjects.map(project => {
        const client = clients.find(c => c.id === project.clientId);
        
        const projectAllocations = allocations.filter(a => {
            const date = parseISO(a.weekStartDate);
            return a.projectId === project.id && date >= monthStart && date <= monthEnd;
        });

        // Calculamos COMPUTADO (Solo tareas completadas)
        const computedHours = projectAllocations
            .filter(a => a.status === 'completed')
            .reduce((sum, a) => sum + (a.hoursActual || a.hoursAssigned), 0);

        const budget = project.budgetHours || 0;
        const minimum = project.minimumHours || 0;
        
        const progress = budget > 0 ? (computedHours / budget) * 100 : 0;

        return {
            id: project.id,
            project: project.name,
            client: client?.name || 'Sin Cliente',
            progress: round2(progress),
            contracted: round2(budget),
            computed: round2(computedHours),
            minimum: round2(minimum)
        };
    }).filter(row => row.contracted > 0 || row.computed > 0)
      .sort((a, b) => b.progress - a.progress);
  }, [projects, clients, allocations, monthStart, monthEnd]);

  const monthsList = Array.from({ length: 12 }, (_, i) => subMonths(new Date(), i));

  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8 max-w-[1800px] mx-auto w-full">
      
      {/* Cabecera de Control */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <FileDown className="h-8 w-8 text-indigo-600" />
                Informes de clientes
            </h1>
            <p className="text-muted-foreground">
                Genera el resumen mensual para enviar (Formato Horizontal).
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

            <Button onClick={() => handlePrint()} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm">
                <Printer className="h-4 w-4" />
                Imprimir PDF
            </Button>
        </div>
      </div>

      {/* --- ÁREA DE VISTA PREVIA (LANDSCAPE) --- */}
      <div className="flex-1 overflow-auto bg-slate-100/50 p-4 md:p-8 flex justify-center items-start">
        {/* Usamos dimensiones fijas para simular A4 Landscape, pero permitimos scroll si la pantalla es pequeña */}
        <div ref={componentRef} className="bg-white shadow-xl w-full max-w-[297mm] min-h-[210mm] p-[15mm] mx-auto print:shadow-none print:w-full print:max-w-none print:p-0 print:m-0">
            
            {/* Cabecera del Informe */}
            <div className="flex justify-between items-end border-b-2 border-indigo-600 pb-4 mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Informe de horas</h2>
                    <p className="text-base text-slate-500 mt-1">Resumen ejecutivo de actividad y computación</p>
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Periodo Reportado</div>
                    <div className="text-2xl font-bold text-slate-800 capitalize leading-none">
                        {format(selectedMonth, 'MMMM yyyy', { locale: es })}
                    </div>
                </div>
            </div>

            {/* Tabla de Datos */}
            <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="border-b border-slate-200">
                            <TableHead className="font-bold text-slate-700 w-[30%] py-3">PROYECTO</TableHead>
                            <TableHead className="font-bold text-slate-700 w-[20%]">CLIENTE</TableHead>
                            <TableHead className="font-bold text-slate-700 text-center w-[12%]">PROGRESO</TableHead>
                            <TableHead className="font-bold text-slate-700 text-right w-[12%]">CONTRATADO</TableHead>
                            <TableHead className="font-bold text-slate-700 text-right w-[12%] bg-slate-100/50">COMPUTADO</TableHead>
                            <TableHead className="font-bold text-slate-700 text-right w-[14%]">MINIMO</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportData.map((row) => (
                            <TableRow key={row.id} className="hover:bg-slate-50/50 border-b border-slate-100 last:border-0">
                                <TableCell className="font-semibold text-slate-800 py-3 text-sm">
                                    {row.project}
                                </TableCell>
                                <TableCell className="text-slate-500 text-sm">
                                    {row.client}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline" className={cn(
                                        "font-mono font-bold px-2",
                                        row.progress > 100 ? "bg-red-50 text-red-700 border-red-200" :
                                        row.progress > 85 ? "bg-amber-50 text-amber-700 border-amber-200" :
                                        "bg-green-50 text-green-700 border-green-200"
                                    )}>
                                        {row.progress.toFixed(0)}%
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-600 text-sm">
                                    {row.contracted.toFixed(2)}h
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-slate-900 bg-slate-50 text-sm">
                                    {row.computed.toFixed(2)}h
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-400 text-sm">
                                    {row.minimum > 0 ? `${row.minimum.toFixed(2)}h` : '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pie de página */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between text-[10px] text-slate-400 uppercase tracking-wider">
                <span>Timeboxing App • Informe Automático</span>
                <span>Generado el {format(new Date(), "dd/MM/yyyy 'a las' HH:mm")}</span>
            </div>

        </div>
      </div>
    </div>
  );
}
