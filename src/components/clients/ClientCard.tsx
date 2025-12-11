import { useState } from 'react';
import { Client } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, TrendingUp, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface ClientCardProps {
  client: Client;
}

const colorOptions = [
  '#0d9488', '#dc2626', '#7c3aed', '#ea580c', '#0284c7', '#16a34a',
  '#db2777', '#9333ea', '#f59e0b', '#06b6d4', '#84cc16', '#6366f1'
];

export function ClientCard({ client }: ClientCardProps) {
  const { getClientHoursForMonth, projects, updateClient, deleteClient } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editedClient, setEditedClient] = useState(client);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const currentMonth = new Date();
  const { used, budget, percentage } = getClientHoursForMonth(client.id, currentMonth);
  
  const clientProjects = projects.filter(p => p.clientId === client.id && p.status === 'active');
  
  const isOverBudget = percentage > 100;
  const isNearLimit = percentage > 85 && percentage <= 100;

  const handleSave = () => {
    if (!editedClient.name.trim()) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    updateClient(editedClient);
    setIsEditing(false);
    toast({ title: "Cliente actualizado", description: `${editedClient.name} ha sido actualizado` });
  };

  const handleDelete = () => {
    deleteClient(client.id);
    setIsDeleting(false);
    toast({ title: "Cliente eliminado", description: `${client.name} y sus proyectos han sido eliminados` });
  };

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
          <div className="flex items-center gap-1">
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
            
            {/* Edit Dialog */}
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Pencil className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar cliente</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={editedClient.name}
                      onChange={(e) => setEditedClient({ ...editedClient, name: e.target.value })}
                      placeholder="Nombre del cliente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Presupuesto mensual (horas)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editedClient.monthlyBudgetHours}
                      onChange={(e) => setEditedClient({ ...editedClient, monthlyBudgetHours: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setEditedClient({ ...editedClient, color })}
                          className={cn(
                            "h-8 w-8 rounded-lg transition-all",
                            editedClient.color === color && "ring-2 ring-offset-2 ring-primary"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  <Button onClick={handleSave}>Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>¿Eliminar cliente?</DialogTitle>
                </DialogHeader>
                <p className="text-muted-foreground">
                  Esta acción eliminará a <strong>{client.name}</strong> y todos sus proyectos asociados.
                </p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleting(false)}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
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
