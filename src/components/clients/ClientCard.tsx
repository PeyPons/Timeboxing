import { Client } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientCardProps {
  client: Client;
}

export function ClientCard({ client }: ClientCardProps) {
  const { getClientHoursForMonth, projects } = useApp();
  const currentMonth = new Date();
  const { used, budget, percentage } = getClientHoursForMonth(client.id, currentMonth);
  
  const clientProjects = projects.filter(p => p.clientId === client.id && p.status === 'active');
  
  const isOverBudget = percentage > 100;
  const isNearLimit = percentage > 85 && percentage <= 100;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg animate-fade-in">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: client.color }}
            >
              {client.name.charAt(0)}
            </div>
            <div>
              <CardTitle className="text-lg">{client.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {clientProjects.length} proyecto{clientProjects.length !== 1 ? 's' : ''} activo{clientProjects.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {isOverBudget && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Excedido
            </Badge>
          )}
          {isNearLimit && (
            <Badge variant="secondary" className="gap-1 bg-warning/10 text-warning border-warning/30">
              <TrendingUp className="h-3 w-3" />
              Ajustado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Presupuesto mensual</span>
            <span className={cn(
              "font-bold",
              isOverBudget && "text-destructive",
              isNearLimit && "text-warning",
              !isOverBudget && !isNearLimit && "text-foreground"
            )}>
              {used}h / {budget}h
            </span>
          </div>
          <Progress 
            value={Math.min(percentage, 100)} 
            className={cn(
              "h-2",
              isOverBudget && "[&>div]:bg-destructive",
              isNearLimit && "[&>div]:bg-warning"
            )}
          />
          <p className="text-xs text-muted-foreground text-right">
            {percentage.toFixed(0)}% utilizado
          </p>
        </div>

        {/* Projects List */}
        <div className="space-y-1.5">
          {clientProjects.map((project) => (
            <div 
              key={project.id}
              className="flex items-center gap-2 text-sm py-1"
            >
              <div 
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: client.color }}
              />
              <span className="text-muted-foreground">{project.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
