import { Outlet } from 'react-router-dom'; // <--- IMPORTANTE
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50"> {/* Fondo gris suave general */}
      <Sidebar />
      {/* El margen izquierdo (ml-64) empuja el contenido para no quedar debajo del Sidebar */}
      <main className="ml-64 min-h-screen">
        {/* Outlet es donde React Router inyecta la página que toca (Dashboard, Planner, etc.) */}
        <Outlet /> 
      </main>
    </div>
  );
}
