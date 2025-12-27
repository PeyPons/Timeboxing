import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { AppLayout } from "@/components/layout/AppLayout";

// Componentes de Auth
import Login from "./pages/Login";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PermissionProtectedRoute } from "./components/auth/PermissionProtectedRoute";

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
      <AuthProvider>
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
                    {/* Dashboard Personal como página de inicio - Siempre accesible */}
                    <Route path="/" element={<EmployeeDashboard />} />
                    
                    {/* Resto de rutas protegidas por permisos */}
                    <Route path="/planner" element={<PermissionProtectedRoute requiredPermission="/planner"><Index /></PermissionProtectedRoute>} />
                    <Route path="/deadlines" element={<PermissionProtectedRoute requiredPermission="/deadlines"><DeadlinesPage /></PermissionProtectedRoute>} />
                    <Route path="/team" element={<PermissionProtectedRoute requiredPermission="/team"><TeamPage /></PermissionProtectedRoute>} />
                    <Route path="/clients" element={<PermissionProtectedRoute requiredPermission="/clients"><ClientsPage /></PermissionProtectedRoute>} />
                    <Route path="/projects" element={<PermissionProtectedRoute requiredPermission="/projects"><ProjectsPage /></PermissionProtectedRoute>} />
                    <Route path="/reports" element={<PermissionProtectedRoute requiredPermission="/reports"><ReportsPage /></PermissionProtectedRoute>} />
                    <Route path="/informes-clientes" element={<PermissionProtectedRoute requiredPermission="/informes-clientes"><ClientReportsPage /></PermissionProtectedRoute>} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/ads" element={<PermissionProtectedRoute requiredPermission="/ads"><AdsPage /></PermissionProtectedRoute>} />
                    <Route path="/meta-ads" element={<PermissionProtectedRoute requiredPermission="/meta-ads"><MetaAdsPage /></PermissionProtectedRoute>} />
                    <Route path="/ads-reports" element={<PermissionProtectedRoute requiredPermission="/ads-reports"><AdsReportGenerator /></PermissionProtectedRoute>} />
                    <Route path="/dashboard-ai" element={<DashboardAI />} />
                  </Route>
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
                
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
