import { Suspense, lazy } from "react";
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

// Página principal (carga inmediata para mejor UX)
import EmployeeDashboard from "./pages/EmployeeDashboard";

// Páginas con lazy loading (carga diferida para mejor rendimiento)
const DashboardAI = lazy(() => import("./pages/DashboardAI"));
const ClientReportsPage = lazy(() => import("@/pages/ClientReportsPage"));
const Index = lazy(() => import("./pages/Index"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const ClientsAndProjectsPage = lazy(() => import("./pages/ClientsAndProjectsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const MetaAdsPage = lazy(() => import("./pages/MetaAdsPage"));
const AdsPage = lazy(() => import("@/pages/AdsPage"));
const AdsReportGenerator = lazy(() => import("./pages/AdsReportGenerator"));
const DeadlinesPage = lazy(() => import("./pages/DeadlinesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback para páginas lazy
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
  </div>
);

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

                    {/* Resto de rutas protegidas por permisos - con Suspense para lazy loading */}
                    <Route path="/planner" element={<Suspense fallback={<PageLoader />}><PermissionProtectedRoute requiredPermission="/planner"><Index /></PermissionProtectedRoute></Suspense>} />
                    <Route path="/deadlines" element={<Suspense fallback={<PageLoader />}><PermissionProtectedRoute requiredPermission="/deadlines"><DeadlinesPage /></PermissionProtectedRoute></Suspense>} />
                    <Route path="/team" element={<Suspense fallback={<PageLoader />}><PermissionProtectedRoute requiredPermission="/team"><TeamPage /></PermissionProtectedRoute></Suspense>} />
                    <Route path="/clients" element={<Suspense fallback={<PageLoader />}><PermissionProtectedRoute requiredPermission="/clients"><ClientsAndProjectsPage /></PermissionProtectedRoute></Suspense>} />
                    <Route path="/projects" element={<Suspense fallback={<PageLoader />}><PermissionProtectedRoute requiredPermission="/projects"><ClientsAndProjectsPage /></PermissionProtectedRoute></Suspense>} />
                    <Route path="/reports" element={<Suspense fallback={<PageLoader />}><PermissionProtectedRoute requiredPermission="/reports"><ReportsPage /></PermissionProtectedRoute></Suspense>} />
                    <Route path="/informes-clientes" element={<Suspense fallback={<PageLoader />}><PermissionProtectedRoute requiredPermission="/informes-clientes"><ClientReportsPage /></PermissionProtectedRoute></Suspense>} />
                    <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
                    <Route path="/ads" element={<Suspense fallback={<PageLoader />}><PermissionProtectedRoute requiredPermission="/ads"><AdsPage /></PermissionProtectedRoute></Suspense>} />
                    <Route path="/meta-ads" element={<Suspense fallback={<PageLoader />}><PermissionProtectedRoute requiredPermission="/meta-ads"><MetaAdsPage /></PermissionProtectedRoute></Suspense>} />
                    <Route path="/ads-reports" element={<Suspense fallback={<PageLoader />}><PermissionProtectedRoute requiredPermission="/ads-reports"><AdsReportGenerator /></PermissionProtectedRoute></Suspense>} />
                    <Route path="/dashboard-ai" element={<Suspense fallback={<PageLoader />}><DashboardAI /></Suspense>} />
                  </Route>
                </Route>

                {/* 404 */}
                <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
                
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
