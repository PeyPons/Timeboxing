import { Suspense } from "react";
import { Toaster } from "@/lib/notify";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import "./i18n/config";
import { AuthProvider } from "@/contexts/AuthContext";
import { AgencyProvider } from "@/contexts/AgencyContext";
import { PrivacyDemoProvider } from "@/contexts/PrivacyDemoContext";
import { DepartmentViewProvider } from "@/contexts/DepartmentViewContext";
import { AppProvider } from "@/contexts/AppContext";
import { GoalsProvider } from "@/contexts/GoalsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageLoader } from "@/components/layout/PageLoader";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { NotificationEngineHost } from "@/components/notifications/NotificationEngineHost";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Componentes de auth
import Login from "./pages/Login";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PermissionProtectedRoute } from "./components/auth/PermissionProtectedRoute";
import { PlatformAdminRoute } from "./components/auth/PlatformAdminRoute";
import { AdminLayout } from "./components/layout/AdminLayout";
import SuspendedPage from "./pages/SuspendedPage";
import AccountInactivePage from "./pages/AccountInactivePage";
import AdminAgenciesPage from "./pages/admin/AdminAgenciesPage";
import AdminAdminsPage from "./pages/admin/AdminAdminsPage";
import AdminSupportPage from "./pages/admin/AdminSupportPage";
import AdminMetricsPage from "./pages/admin/AdminMetricsPage";
import AdminDocsPage from "./pages/admin/AdminDocsPage";
import AdminBlogPage from "./pages/admin/AdminBlogPage";
import AdminBlogEditorPage from "./pages/admin/AdminBlogEditorPage";

import LandingPage from "./pages/LandingPage";
import ArticlePage from "./pages/ArticlePage";
import BlogPage from "./pages/BlogPage";
import BlogArticleDynamicPage from "./pages/BlogArticleDynamicPage";
import EmployeeDashboardLandingPage from "./pages/EmployeeDashboardLandingPage";
import PlannerLandingPage from "./pages/PlannerLandingPage";
import TeamLandingPage from "./pages/TeamLandingPage";
import ReportsLandingPage from "./pages/ReportsLandingPage";
import ProjectsLandingPage from "./pages/ProjectsLandingPage";
import IntegrationsLandingPage from "./pages/IntegrationsLandingPage";
import PpcMonitorLandingPage from "./pages/PpcMonitorLandingPage";
import SecurityLandingPage from "./pages/SecurityLandingPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import PreciosPage from "./pages/PreciosPage";
import GuiaPage from "./pages/GuiaPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import OpenApiViewerPage from "./pages/OpenApiViewerPage";
import PresentationPage from "./pages/PresentationPage";
import ContactoPage from "./pages/ContactoPage";
import { ModuleGuard } from "./components/auth/ModuleGuard";
import { PlanGuard } from "./components/auth/PlanGuard";
import { BrandingEffect } from "./components/layout/BrandingEffect";
import { ScrollToTop } from "./components/ScrollToTop";
import { AgencySearchParamSync } from "./components/agency/AgencySearchParamSync";
import { CookieBanner } from "./components/landing/CookieBanner";
import { PublicLocaleSync } from "@/i18n/PublicLocaleSync";
import { BlogPathSync } from "@/i18n/BlogPathSync";
import { RouteHreflangSync } from "@/seo/RouteHreflangSync";

// Páginas con lazy loading (recuperación automática si el chunk ya no existe tras un deploy)
const EmployeeDashboard = lazyWithRetry(() => import("./pages/EmployeeDashboard"));
const OperationsRadarPage = lazyWithRetry(() => import("./pages/OperationsRadarPage"));
const FinancialHealthPage = lazyWithRetry(() => import("./pages/FinancialHealthPage"));
const TeamCapacityDashboard = lazyWithRetry(() => import("./pages/TeamCapacityDashboard"));
const Index = lazyWithRetry(() => import("./pages/Index"));
const TeamPage = lazyWithRetry(() => import("./pages/TeamPage"));
const ClientsAndProjectsPage = lazyWithRetry(() => import("./pages/ClientsAndProjectsPage"));
const SettingsPage = lazyWithRetry(() => import("./pages/SettingsPage"));
const MetaAdsPage = lazyWithRetry(() => import("./pages/MetaAdsPage"));
const AdsPage = lazyWithRetry(() => import("@/pages/AdsPage"));
const DeadlinesPage = lazyWithRetry(() => import("./pages/DeadlinesPage"));
const WeeklyForecastPage = lazyWithRetry(() => import("./pages/WeeklyForecastPage"));
const ActivityPage = lazyWithRetry(() => import("./pages/ActivityPage"));
const OkrsPage = lazyWithRetry(() => import("./pages/OkrsPage"));
const AgencySettingsPage = lazyWithRetry(() => import("./pages/AgencySettingsPage"));
const DataExportHubPage = lazyWithRetry(() => import("./pages/DataExportHubPage"));
const AgenciesPage = lazyWithRetry(() => import("./pages/AgenciesPage"));
const AgencyManagementPage = lazyWithRetry(() => import("./pages/AgencyManagementPage"));
const OnboardingWizard = lazyWithRetry(() => import("./components/onboarding/OnboardingWizard"));
const OnboardingChoicePage = lazyWithRetry(() => import("./pages/OnboardingChoicePage"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const TeamPulsePage = lazyWithRetry(() => import("./pages/TeamPulsePage"));
const TiemposPage = lazyWithRetry(() => import("./pages/TiemposPage"));
const ApiKeysPage = lazyWithRetry(() => import("./pages/ApiKeysPage"));
const ContactSupportPage = lazyWithRetry(() => import("./pages/ContactSupportPage"));
const ReviewAgentsPage = lazyWithRetry(() => import("./pages/ReviewAgentsPage"));
const GoogleCallbackPage = lazyWithRetry(() => import("./pages/GoogleCallbackPage"));
const MetaCallbackPage = lazyWithRetry(() => import("./pages/MetaCallbackPage"));
const ResetPasswordPage = lazyWithRetry(() => import("./pages/ResetPasswordPage"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos - datos se consideran frescos
      gcTime: 30 * 60 * 1000, // 30 minutos - tiempo en cache (antes cacheTime)
      refetchOnWindowFocus: false, // No refetch al cambiar de pestaña
      retry: 1, // Solo 1 reintento en caso de error
    },
  },
});

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AgencyProvider>
          <PrivacyDemoProvider>
          <DepartmentViewProvider>
            <AppProvider>
              <GoalsProvider>
                  <TooltipProvider>
                    <BrandingEffect />
                    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
                    <AgencySearchParamSync />
                    <PublicLocaleSync />
                    <BlogPathSync />
                    <RouteHreflangSync />
                    <Toaster />
                    <NotificationProvider>
                      <NotificationEngineHost />
                      <ScrollToTop />
                      <CookieBanner />
                      <Routes>
                        {/* Página de inicio (Landing) */}
                        <Route path="/" element={<LandingPage />} />

                        {/* Artículo: por qué Taimbox (página pública) */}
                        <Route path="/por-que-timeboxing" element={<ArticlePage />} />

                        {/* Blog (índice + artículos dinámicos resueltos desde Supabase). */}
                        <Route path="/blog" element={<BlogPage />} />
                        <Route path="/blog/:slug" element={<BlogArticleDynamicPage />} />
                        {/* Redirección 301: URL antigua del artículo */}
                        <Route path="/que-es-timeboxing" element={<Navigate to="/blog/que-es-timeboxing" replace />} />

                        {/* Landing comercial: Dashboard del Empleado (página pública) */}
                        <Route path="/dashboard-empleado" element={<EmployeeDashboardLandingPage />} />

                        {/* Landings comerciales de funcionalidades (páginas públicas) */}
                        <Route path="/planificador-recursos" element={<PlannerLandingPage />} />
                        <Route path="/gestion-equipos" element={<TeamLandingPage />} />
                        <Route path="/reportes-rentabilidad" element={<ReportsLandingPage />} />
                        <Route path="/control-proyectos" element={<ProjectsLandingPage />} />
                        <Route path="/integraciones" element={<IntegrationsLandingPage />} />
                        <Route path="/monitor-ppc" element={<PpcMonitorLandingPage />} />
                        <Route path="/seguridad" element={<SecurityLandingPage />} />
                        <Route path="/privacidad" element={<PrivacyPolicyPage />} />
                        <Route path="/condiciones" element={<TermsOfServicePage />} />
                        <Route path="/precios" element={<PreciosPage />} />

                        {/* Guía de funcionalidades (páginas públicas detalladas) */}
                        <Route path="/guia" element={<GuiaPage />} />
                        <Route path="/guia/:section" element={<GuiaPage />} />

                        <Route path="/contacto" element={<ContactoPage />} />

                        {/* Documentación API (pública) */}
                        <Route path="/api-docs" element={<ApiDocsPage />} />
                        <Route path="/api-docs/openapi" element={<OpenApiViewerPage />} />

                        {/* Presentación interna (oculta, no enlazada) */}
                        <Route path="/pitch" element={<PresentationPage />} />

                        {/* Páginas públicas en inglés (/en/...) */}
                        <Route path="/en" element={<LandingPage />} />
                        <Route path="/en/why-taimbox" element={<ArticlePage />} />
                        <Route path="/en/blog" element={<BlogPage />} />
                        <Route path="/en/blog/:slug" element={<BlogArticleDynamicPage />} />
                        <Route path="/en/employee-dashboard" element={<EmployeeDashboardLandingPage />} />
                        <Route path="/en/resource-planner" element={<PlannerLandingPage />} />
                        <Route path="/en/team-management" element={<TeamLandingPage />} />
                        <Route path="/en/reports-profitability" element={<ReportsLandingPage />} />
                        <Route path="/en/project-control" element={<ProjectsLandingPage />} />
                        <Route path="/en/integrations" element={<IntegrationsLandingPage />} />
                        <Route path="/en/ppc-monitor" element={<PpcMonitorLandingPage />} />
                        <Route path="/en/security" element={<SecurityLandingPage />} />
                        <Route path="/en/privacy" element={<PrivacyPolicyPage />} />
                        <Route path="/en/terms" element={<TermsOfServicePage />} />
                        <Route path="/en/pricing" element={<PreciosPage />} />
                        <Route path="/en/guide" element={<GuiaPage />} />
                        <Route path="/en/guide/:section" element={<GuiaPage />} />
                        <Route path="/en/contact" element={<ContactoPage />} />
                        <Route path="/en/api-docs" element={<ApiDocsPage />} />
                        <Route path="/en/api-docs/openapi" element={<OpenApiViewerPage />} />
                        <Route path="/en/pitch" element={<PresentationPage />} />

                        {/* Ruta pública Login */}
                        <Route path="/login" element={<Login />} />

                        {/* Ruta pública: restablecer contraseña */}
                        <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />

                        {/* Rutas Protegidas */}
                        <Route element={<ProtectedRoute />}>
                          {/* Onboarding (sin AppLayout) */}
                          <Route path="/onboarding/choose" element={<Suspense fallback={<PageLoader />}><OnboardingChoicePage /></Suspense>} />
                          <Route path="/onboarding" element={<Suspense fallback={<PageLoader />}><OnboardingWizard /></Suspense>} />

                          {/* Suspended: fuera de AppLayout, solo sesión */}
                          <Route path="/suspended" element={<SuspendedPage />} />
                          <Route path="/account-inactive" element={<AccountInactivePage />} />

                          {/* Google OAuth Callback (sin AppLayout, página de transición) */}
                          <Route path="/google-callback" element={<Suspense fallback={<PageLoader />}><GoogleCallbackPage /></Suspense>} />

                          {/* Meta (Facebook) OAuth Callback */}
                          <Route path="/meta-callback" element={<Suspense fallback={<PageLoader />}><MetaCallbackPage /></Suspense>} />

                          {/* Área admin: sin AgencyContext, solo platform_admin */}
                          <Route path="/admin" element={<PlatformAdminRoute />}>
                            <Route element={<AdminLayout />}>
                              <Route index element={<Navigate to="/admin/agencies" replace />} />
                              <Route path="agencies" element={<AdminAgenciesPage />} />
                              <Route path="admins" element={<AdminAdminsPage />} />
                              <Route path="support" element={<AdminSupportPage />} />
                              <Route path="metrics" element={<AdminMetricsPage />} />
                              <Route path="docs" element={<AdminDocsPage />} />
                              <Route path="blog" element={<AdminBlogPage />} />
                              <Route path="blog/new" element={<AdminBlogEditorPage />} />
                              <Route path="blog/edit/:id" element={<AdminBlogEditorPage />} />
                            </Route>
                          </Route>

                          <Route element={<AppLayout />}>
                            {/* Dashboard Personal */}
                            <Route path="/dashboard" element={<EmployeeDashboard />} />

                            {/* Rutas protegidas por permisos (Suspense centralizado en AppLayout) */}
                            <Route path="/planner" element={<PermissionProtectedRoute requiredPermission="/planner"><Index /></PermissionProtectedRoute>} />
                            <Route path="/deadlines" element={<PermissionProtectedRoute requiredPermission="/deadlines"><ModuleGuard module="deadlines"><DeadlinesPage /></ModuleGuard></PermissionProtectedRoute>} />
                            <Route path="/team" element={<PermissionProtectedRoute requiredPermission="/team"><TeamPage /></PermissionProtectedRoute>} />
                            <Route path="/tiempos" element={<PlanGuard><PermissionProtectedRoute requiredPermission="/team"><ModuleGuard module="timeTracker"><TiemposPage /></ModuleGuard></PermissionProtectedRoute></PlanGuard>} />
                            <Route path="/team/pulse" element={<TeamPulsePage />} />
                            <Route path="/team-capacity" element={<Navigate to="/capacidad" replace />} />

                            {/* Nuevas vistas del Manager Hub */}
                            <Route path="/operaciones" element={<PlanGuard><PermissionProtectedRoute requiredPermission="/operaciones"><OperationsRadarPage /></PermissionProtectedRoute></PlanGuard>} />
                            <Route path="/finanzas" element={<PlanGuard><PermissionProtectedRoute requiredPermission="/finanzas"><FinancialHealthPage /></PermissionProtectedRoute></PlanGuard>} />
                            <Route path="/capacidad" element={<PlanGuard><PermissionProtectedRoute requiredPermission="/team-capacity"><TeamCapacityDashboard /></PermissionProtectedRoute></PlanGuard>} />

                            <Route path="/clients" element={<PermissionProtectedRoute requiredPermission="/clients"><ClientsAndProjectsPage /></PermissionProtectedRoute>} />
                            <Route path="/projects" element={<PermissionProtectedRoute requiredPermission="/projects"><ClientsAndProjectsPage /></PermissionProtectedRoute>} />
                            <Route path="/okrs" element={<PlanGuard><PermissionProtectedRoute requiredPermission="/okrs"><ModuleGuard module="professionalGoals"><OkrsPage /></ModuleGuard></PermissionProtectedRoute></PlanGuard>} />

                            {/* Ruta legacy /reports redirige a Seguimiento operativo */}
                            <Route path="/reports" element={<Navigate to="/operaciones" replace />} />
                            {/* Weekly Forecast: cierre semanal y redistribución (acceso restaurado) */}
                            <Route path="/weekly-forecast" element={<PlanGuard><PermissionProtectedRoute requiredPermission="/weekly-forecast"><ModuleGuard module="weeklyFeedback"><WeeklyForecastPage /></ModuleGuard></PermissionProtectedRoute></PlanGuard>} />
                            {/* Registro de actividad: historial de auditoría independiente del módulo Weekly */}
                            <Route path="/actividad" element={<PlanGuard><PermissionProtectedRoute requiredPermission="/actividad"><ActivityPage /></PermissionProtectedRoute></PlanGuard>} />
                            <Route path="/settings" element={<PermissionProtectedRoute requiredPermission="/settings"><SettingsPage /></PermissionProtectedRoute>} />
                            <Route path="/agency" element={<PermissionProtectedRoute requiredPermission="/agency"><AgencySettingsPage /></PermissionProtectedRoute>} />
                            <Route path="/exportacion-informes" element={<PlanGuard><PermissionProtectedRoute requiredPermission="/exportacion-informes"><DataExportHubPage /></PermissionProtectedRoute></PlanGuard>} />
                            <Route path="/agencies" element={<AgenciesPage />} />
                            <Route path="/agencies/:id/manage" element={<PermissionProtectedRoute requiredPermission="/settings"><AgencyManagementPage /></PermissionProtectedRoute>} />
                            <Route path="/ads" element={<PlanGuard><PermissionProtectedRoute requiredPermission="/ads"><ModuleGuard module="ppc"><AdsPage /></ModuleGuard></PermissionProtectedRoute></PlanGuard>} />
                            <Route path="/meta-ads" element={<PlanGuard><PermissionProtectedRoute requiredPermission="/meta-ads"><ModuleGuard module="ppc"><MetaAdsPage /></ModuleGuard></PermissionProtectedRoute></PlanGuard>} />
                            <Route path="/api-keys" element={<PlanGuard><PermissionProtectedRoute requiredPermission="/api-keys"><ApiKeysPage /></PermissionProtectedRoute></PlanGuard>} />
                            <Route path="/soporte" element={<PermissionProtectedRoute requiredPermission="/soporte"><ContactSupportPage /></PermissionProtectedRoute>} />
                            <Route path="/review-agents" element={<PermissionProtectedRoute requiredPermission="/review-agents"><ReviewAgentsPage /></PermissionProtectedRoute>} />
                          </Route>
                        </Route>

                        {/* 404 */}
                        <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />

                      </Routes>
                    </NotificationProvider>
                    </BrowserRouter>
                  </TooltipProvider>
              </GoalsProvider>
            </AppProvider>
          </DepartmentViewProvider>
          </PrivacyDemoProvider>
        </AgencyProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
