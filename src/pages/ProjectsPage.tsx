import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';

export default function ProjectsPage() {
  const { projects, clients } = useApp();

  const getClientForProject = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const client = getClientForProject(project.clientId);
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
                  <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                    {project.status === 'active' ? 'Activo' : 'Archivado'}
                  </Badge>
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
