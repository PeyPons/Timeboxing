import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AppProvider } from "@/contexts/AppContext";
import { AppLayout } from "@/components/layout/AppLayout";
import DashboardAI from "./pages/DashboardAI";
import ClientReportsPage from '@/pages/ClientReportsPage';
import Index from "./pages/Index";
import TeamPage from "./pages/TeamPage";
import ClientsPage from "./pages/ClientsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import AdsPage from '@/pages/AdsPage';
import AdsReportGenerator from './pages/AdsReportGenerator';
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
                {/* 1. La ruta raíz "/" carga el Dashboard con IA */}
                <Route path="/" element={<DashboardAI />} />
                
                {/* 2. ✅ AÑADIDO: La ruta explícita para el botón del menú "Copiloto IA" */}
                <Route path="/dashboard-ai" element={<DashboardAI />} />
                
                {/* 3. El Planificador antiguo está en /planner */}
                <Route path="/planner" element={<Index />} />
                
                <Route path="/team" element={<TeamPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/informes-clientes" element={<ClientReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/ads" element={<AdsPage />} />
                <Route path="/ads-reports" element={<AdsReportGenerator />} />
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
