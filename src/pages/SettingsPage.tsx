import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
            <p className="text-muted-foreground">
              Ajustes generales de la aplicación
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar datos
            </CardTitle>
            <CardDescription>
              Importa datos desde archivos CSV o Excel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border-2 border-dashed border-muted p-8 text-center">
              <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Arrastra un archivo CSV o haz clic para seleccionar
              </p>
              <Button variant="outline" className="mt-4">
                Seleccionar archivo
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              El importador detectará automáticamente las columnas de empleados, proyectos y horas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximas funcionalidades</CardTitle>
            <CardDescription>
              Características en desarrollo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                Importador inteligente de Excel
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                Exportación de reportes PDF
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                Integración con Google Calendar
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                Notificaciones por email
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
