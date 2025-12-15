import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AppProvider } from "@/contexts/AppContext";
import { AppLayout } from "@/components/layout/AppLayout";

// Importamos las páginas
import DashboardAI from "./pages/DashboardAI";
import Index from "./pages/Index"; // Planificador
import TeamPage from "./pages/TeamPage";
import ClientsPage from "./pages/ClientsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import ClientReportsPage from "./pages/ClientReportsPage"; // ✅ IMPORTACIÓN AÑADIDA
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppLayout>
              <Routes>
                {/* Dashboard Principal */}
                <Route path="/" element={<DashboardAI />} />
                
                {/* Planificador */}
                <Route path="/planner" element={<Index />} />
                
                {/* Gestión */}
                <Route path="/team" element={<TeamPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                
                {/* Informes y Análisis */}
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/informes-clientes" element={<ClientReportsPage />} /> {/* ✅ RUTA AÑADIDA */}
                
                {/* Configuración */}
                <Route path="/settings" element={<SettingsPage />} />
                
                {/* Error 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
