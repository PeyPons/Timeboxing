import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { ClientCard } from '@/components/clients/ClientCard';
import { Briefcase, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const colorOptions = [
  '#0d9488', '#dc2626', '#7c3aed', '#ea580c', '#0284c7', '#16a34a',
  '#db2777', '#9333ea', '#f59e0b', '#06b6d4', '#84cc16', '#6366f1'
];

export default function ClientsPage() {
  const { clients, addClient } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    color: colorOptions[0],
  });

  const handleAdd = () => {
    if (!newClient.name.trim()) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    addClient(newClient);
    setNewClient({ name: '', color: colorOptions[0] });
    setIsAdding(false);
    toast({ title: "Cliente creado", description: `${newClient.name} ha sido añadido` });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground">
              Horas totales calculadas desde los proyectos
            </p>
          </div>
        </div>

        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="Nombre del cliente"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewClient({ ...newClient, color })}
                      className={cn(
                        "h-8 w-8 rounded-lg transition-all",
                        newClient.color === color && "ring-2 ring-offset-2 ring-primary"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAdding(false)}>Cancelar</Button>
              <Button onClick={handleAdd}>Crear cliente</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </div>
    </div>
  );
}
