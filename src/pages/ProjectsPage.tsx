import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function ProjectsPage() {
  const { projects, clients, addProject, updateProject, deleteProject } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<string | null>(null);
  
  const [newProject, setNewProject] = useState({
    name: '',
    clientId: '',
    status: 'active' as const,
  });

  const getClientForProject = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  const handleAdd = () => {
    if (!newProject.name.trim()) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    if (!newProject.clientId) {
      toast({ title: "Error", description: "Selecciona un cliente", variant: "destructive" });
      return;
    }
    addProject(newProject);
    setNewProject({ name: '', clientId: '', status: 'active' });
    setIsAdding(false);
    toast({ title: "Proyecto creado", description: `${newProject.name} ha sido añadido` });
  };

  const handleUpdate = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    updateProject(project);
    setEditingProject(null);
    toast({ title: "Proyecto actualizado" });
  };

  const handleDelete = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    deleteProject(projectId);
    setDeletingProject(null);
    toast({ title: "Proyecto eliminado", description: `${project?.name} ha sido eliminado` });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Proyectos</h1>
            <p className="text-muted-foreground">
              Todos los proyectos activos de la agencia
            </p>
          </div>
        </div>

        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo proyecto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo proyecto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Nombre del proyecto"
                />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select 
                  value={newProject.clientId} 
                  onValueChange={(value) => setNewProject({ ...newProject, clientId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: client.color }}
                          />
                          {client.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAdding(false)}>Cancelar</Button>
              <Button onClick={handleAdd}>Crear proyecto</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const client = getClientForProject(project.clientId);
          const isEditing = editingProject === project.id;
          const isDeleting = deletingProject === project.id;
          
          return (
            <Card key={project.id} className="transition-all hover:shadow-lg animate-fade-in">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: client?.color || '#888' }}
                    />
                    <CardTitle className="text-base">{project.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status === 'active' ? 'Activo' : 'Archivado'}
                    </Badge>
                    
                    {/* Edit Dialog */}
                    <Dialog open={isEditing} onOpenChange={(open) => setEditingProject(open ? project.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar proyecto</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input
                              value={project.name}
                              onChange={(e) => updateProject({ ...project, name: e.target.value })}
                              placeholder="Nombre del proyecto"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Cliente</Label>
                            <Select 
                              value={project.clientId} 
                              onValueChange={(value) => updateProject({ ...project, clientId: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {clients.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="h-3 w-3 rounded-full"
                                        style={{ backgroundColor: c.color }}
                                      />
                                      {c.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Estado</Label>
                            <Select 
                              value={project.status} 
                              onValueChange={(value: 'active' | 'archived') => updateProject({ ...project, status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Activo</SelectItem>
                                <SelectItem value="archived">Archivado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={() => setEditingProject(null)}>Cerrar</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Delete Dialog */}
                    <Dialog open={isDeleting} onOpenChange={(open) => setDeletingProject(open ? project.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>¿Eliminar proyecto?</DialogTitle>
                        </DialogHeader>
                        <p className="text-muted-foreground">
                          Esta acción eliminará <strong>{project.name}</strong> y todas sus asignaciones.
                        </p>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDeletingProject(null)}>Cancelar</Button>
                          <Button variant="destructive" onClick={() => handleDelete(project.id)}>Eliminar</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Cliente: <span className="font-medium text-foreground">{client?.name}</span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
