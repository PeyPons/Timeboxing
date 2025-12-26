import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AppProvider } from "@/contexts/AppContext";
import { AppLayout } from "@/components/layout/AppLayout";

// Componentes de Auth
import Login from "./pages/Login";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

// Páginas (Mantenemos tus imports originales y añadimos el Dashboard nuevo)
import DashboardAI from "./pages/DashboardAI";
import ClientReportsPage from '@/pages/ClientReportsPage';
import Index from "./pages/Index";
import TeamPage from "./pages/TeamPage";
import ClientsPage from "./pages/ClientsPage";
import EmployeeDashboard from "./pages/EmployeeDashboard"; // <--- Importante
import ProjectsPage from "./pages/ProjectsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import MetaAdsPage from './pages/MetaAdsPage';
import AdsPage from '@/pages/AdsPage';
import AdsReportGenerator from './pages/AdsReportGenerator';
import DeadlinesPage from './pages/DeadlinesPage';
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
            <Routes>
              {/* Ruta pública Login */}
              <Route path="/login" element={<Login />} />

              {/* Rutas Protegidas */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  {/* Dashboard Personal como página de inicio */}
                  <Route path="/" element={<EmployeeDashboard />} />
                  
                  {/* Resto de rutas */}
                  <Route path="/planner" element={<Index />} />
                  <Route path="/deadlines" element={<DeadlinesPage />} />
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/informes-clientes" element={<ClientReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/ads" element={<AdsPage />} />
                  <Route path="/meta-ads" element={<MetaAdsPage />} />
                  <Route path="/ads-reports" element={<AdsReportGenerator />} />
                  <Route path="/dashboard-ai" element={<DashboardAI />} />
                </Route>
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
              
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
