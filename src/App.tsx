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

// Páginas
import DashboardAI from "./pages/DashboardAI";
import ClientReportsPage from '@/pages/ClientReportsPage';
import Index from "./pages/Index";
import TeamPage from "./pages/TeamPage";
import ClientsPage from "./pages/ClientsPage";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ProjectsPage from "./pages/ProjectsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import MetaAdsPage from './pages/MetaAdsPage';
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
            <Routes>
              
              {/* RUTA PÚBLICA: Login */}
              {/* Es CRUCIAL que esta ruta esté aquí, fuera del ProtectedRoute */}
              <Route path="/login" element={<Login />} />

              {/* RUTAS PROTEGIDAS */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  {/* Home redirige al dashboard del empleado */}
                  <Route path="/" element={ <EmployeeDashboard />} />
                  
                  <Route path="/dashboard-ai" element={<DashboardAI />} />
                  <Route path="/planner" element={<Index />} />
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/employee" element={ <EmployeeDashboard />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/informes-clientes" element={<ClientReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/ads" element={<AdsPage />} />
                  <Route path="/meta-ads" element={<MetaAdsPage />} />
                  <Route path="/ads-reports" element={<AdsReportGenerator />} />
                </Route>
              </Route>

              {/* 404 para cualquier otra cosa */}
              <Route path="*" element={<NotFound />} />
              
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
