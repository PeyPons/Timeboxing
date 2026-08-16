import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Agency, AgencySettings } from '@/types';
import { useAuth } from './AuthContext';
import {
  getAgencyMembersUtil,
  mapSupabaseAgency,
  fetchAgencyRowForAppClient,
  listMyAgenciesDirectory,
  removeUserFromAgencyUtil,
  transferAgencyOwnershipUtil,
  normalizeAgencySettings,
} from '@/utils/agencyUtils';

// Tipos para respuestas de Supabase (snake_case)
interface SupabaseAgency {
  id: string;
  name: string;
  slug: string;
  settings: AgencySettings;
  setup_completed: boolean;
  status?: string;
  created_at: string;
  updated_at: string;
  google_ads_refresh_token?: string | null;
  google_ads_customer_id?: string | null;
  meta_ads_access_token?: string | null;
  plan_id?: string | null;
  subscription_status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  trial_ends_at?: string | null;
  subscription_period_ends_at?: string | null;
  subscription_cancel_at_period_end?: boolean | null;
  trial_used_at?: string | null;
}

// Tipo exportado para miembros de agencia
export interface AgencyMember {
  id: string;           // employee.id
  userId: string | null; // user_id
  name: string;
  email: string;
  role: string | null;
  department: string | null;
  isActive: boolean;
  isAdmin: boolean;     // Calculado: role contiene keywords de admin
  /** Propietario de la agencia (settings.ownerUserId o heurística legacy); no es user_agencies.is_primary */
  isPrimary: boolean;
}

// Tipo exportado para agencias del usuario con más detalles
export interface UserAgency {
  agencyId: string;
  agencyName: string;
  agency: Agency;
  role: string | null;
  isPrimary: boolean;
}

interface UserAgencyMembershipRow {
  agency_id: string;
  is_impersonation?: boolean;
}

function computeSupportImpersonation(
  agencyId: string | null | undefined,
  membershipRows: UserAgencyMembershipRow[],
  employeeAgencyIds: string[],
): boolean {
  if (!agencyId) return false;
  const impersonating =
    membershipRows.some(
      (row) => row.agency_id === agencyId && row.is_impersonation === true,
    );
  const hasEmployeeInAgency = employeeAgencyIds.includes(agencyId);
  return impersonating && !hasEmployeeInAgency;
}

interface AgencyContextType {
  currentAgency: Agency | null;
  isLoading: boolean;
  error: string | null;
  /** Platform admin en user_agencies.is_impersonation sin empleado en esa agencia. */
  isSupportImpersonation: boolean;
  refreshAgency: () => Promise<void>;
  completeSetup: () => Promise<void>;
  updateAgencyName: (name: string) => Promise<void>;
  updateSettings: (settings: Partial<AgencySettings>) => Promise<void>;
  switchAgency: (agencyId: string) => Promise<void>;
  availableAgencies: Array<{ agencyId: string; agencyName: string }>;
  // Nuevas funciones para gestión de miembros
  userAgencies: UserAgency[];
  getAgencyMembers: (agencyId: string) => Promise<AgencyMember[]>;
  removeUserFromAgency: (userId: string, agencyId: string) => Promise<{ completelyRemoved: boolean }>;
  transferAgencyOwnership: (newOwnerId: string, agencyId: string) => Promise<void>;
  inviteUserToAgency: (
    email: string,
    role?: string,
    department?: string
  ) => Promise<{ employeeId?: string; userId?: string } | null>;
  updateUserAgencyRole: (
    userId: string,
    agencyId: string,
    role: string,
    department?: string
  ) => Promise<void>;
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

export function AgencyProvider({ children }: { children: React.ReactNode }) {
  const { user, isInitialized: isAuthInitialized } = useAuth();
  const [currentAgency, setCurrentAgency] = useState<Agency | null>(null);
  const [isSupportImpersonation, setIsSupportImpersonation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableAgencies, setAvailableAgencies] = useState<Array<{ agencyId: string; agencyName: string }>>([]);
  const [userAgencies, setUserAgencies] = useState<UserAgency[]>([]);
  const isInitialLoadRef = useRef(true);
  const repairAttemptedRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  // mapSupabaseAgency y migraciones se delegan a utils.

  const fetchAgencyForUser = useCallback(async () => {
    if (!user?.email) {
      setCurrentAgency(null);
      setIsSupportImpersonation(false);
      setIsLoading(false);
      isInitialLoadRef.current = false;
      return;
    }

    // --- CORRECCIÓN: Background Revalidation ---
    // Solo mostrar spinner si es la carga inicial (no hay datos).
    // Si ya hay datos, el usuario seguirá viéndolos mientras se actualizan por detrás.
    const isInitialLoad = isInitialLoadRef.current;
    if (isInitialLoad) {
      setIsLoading(true);
    }

    setError(null);

    try {
      // 0. Agencia marcada is_primary en user_agencies (preferencia por defecto del usuario).
      // .limit(1): si hay datos inconsistentes (varias filas is_primary), evitamos error de maybeSingle.
      const { data: primaryRows } = await supabase
        .from('user_agencies')
        .select('agency_id')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .limit(1);
      const primaryAgencyId = primaryRows?.[0]?.agency_id ?? null;

      const urlParams =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlAgencyFromQuery = urlParams?.get('agency')?.trim() || null;

      const { data: uaMembershipRows } = await supabase
        .from('user_agencies')
        .select('agency_id, is_impersonation')
        .eq('user_id', user.id);
      const membershipRows = (uaMembershipRows || []) as UserAgencyMembershipRow[];
      const membershipAgencyIds = [...new Set(membershipRows.map(r => r.agency_id))];
      const urlAgencyInMembership =
        !!(urlAgencyFromQuery && membershipAgencyIds.includes(urlAgencyFromQuery));

      // 1. Buscar TODOS los empleados por email para obtener todas las agencias
      const { data: employeesData, error: employeeError } = await supabase
        .from('employees')
        .select('agency_id, email, user_id, created_at')
        .eq('email', user.email.toLowerCase())
        .order('created_at', { ascending: false });

      // Log para diagnóstico
      if (employeeError) {
        console.debug('[AgencyContext] Error buscando por email:', employeeError);
      }

      let selectedEmployee = employeesData?.[0];
      let allEmployees = employeesData || [];

      // Si no se encuentra por email, intentar con user_id
      if (employeeError || !selectedEmployee?.agency_id) {
        console.debug('[AgencyContext] No se encontró por email, intentando con user_id:', user.id);

        // Intentar buscar por user_id (también puede haber múltiples)
        const { data: employeesByUserId, error: userIdError } = await supabase
          .from('employees')
          .select('agency_id, email, user_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (userIdError) {
          console.debug('[AgencyContext] Error buscando por user_id:', userIdError);
        }

        allEmployees = employeesByUserId || [];
        selectedEmployee = allEmployees[0];

        if (userIdError || !selectedEmployee?.agency_id) {
          // Fallback: agencias ya cargadas en user_agencies; buscar empleado en esas agencias
          console.debug('[AgencyContext] Fallback: buscando empleado en agencias de user_agencies:', user.id);
          const userAgenciesData = membershipRows;

          if (userAgenciesData.length > 0) {
            const agencyIds = userAgenciesData.map(ua => ua.agency_id);
            // Buscar empleado por user_id en esas agencias (evita depender de email en .or())
            const { data: employeesByAgencies, error: empByAgenciesError } = await supabase
              .from('employees')
              .select('agency_id, email, user_id, created_at')
              .in('agency_id', agencyIds)
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });

            if (!empByAgenciesError && employeesByAgencies && employeesByAgencies.length > 0) {
              allEmployees = employeesByAgencies;
              selectedEmployee = employeesByAgencies[0];
              console.debug('[AgencyContext] Empleado encontrado vía user_agencies');
            } else {
              // Último intento: por email dentro de esas agencias
              const { data: byEmail, error: byEmailErr } = await supabase
                .from('employees')
                .select('agency_id, email, user_id, created_at')
                .in('agency_id', agencyIds)
                .eq('email', user.email?.toLowerCase())
                .order('created_at', { ascending: false });
              if (!byEmailErr && byEmail && byEmail.length > 0) {
                allEmployees = byEmail;
                selectedEmployee = byEmail[0];
                console.debug('[AgencyContext] Empleado encontrado por email vía user_agencies');
              }
            }
          }

          if (!selectedEmployee?.agency_id) {
            // Reparar si no hay filas en user_agencies pero el usuario podría tener empleado (ej. tras "Salir de vista" que borró la fila)
            const hasNoUserAgencies = !uaMembershipRows || uaMembershipRows.length === 0;
            if (hasNoUserAgencies && !repairAttemptedRef.current) {
              repairAttemptedRef.current = true;
              try {
                await supabase.rpc('repair_user_agencies_from_employees');
              } catch (_) {
                // ignorar
              }
              return fetchAgencyForUser();
            }
            // Sin empleado pero con user_agencies (ej. platform admin "accediendo como" agencia)
            if (userAgenciesData && userAgenciesData.length > 0) {
              const agencyIds = userAgenciesData.map(ua => ua.agency_id);
              const selectedAgencyId = urlAgencyFromQuery && agencyIds.includes(urlAgencyFromQuery)
                ? urlAgencyFromQuery
                : agencyIds[0];
              if (selectedAgencyId) {
                const storageKey = `selected_agency_${user.id}`;
                localStorage.setItem(storageKey, selectedAgencyId);
                const { data: agencyData, error: agencyErr } = await fetchAgencyRowForAppClient(selectedAgencyId);
                if (!agencyErr && agencyData) {
                  const agency = await mapSupabaseAgency(agencyData);
                  const agenciesList = await listMyAgenciesDirectory();
                  setAvailableAgencies(
                    agenciesList.filter(a => agencyIds.includes(a.agencyId)),
                  );
                  setCurrentAgency(agency);
                  setIsSupportImpersonation(
                    computeSupportImpersonation(
                      selectedAgencyId,
                      membershipRows,
                      allEmployees.map((emp) => emp.agency_id),
                    ),
                  );
                  if (isInitialLoad) setIsLoading(false);
                  return;
                }
              }
            }
            console.warn('[AgencyContext] No se encontró empleado para el usuario:', {
              email: user.email,
              userId: user.id,
              emailError: employeeError,
              userIdError: userIdError
            });
            setCurrentAgency(null);
            setIsSupportImpersonation(false);
            if (isInitialLoad) {
              setIsLoading(false);
            }
            return;
          }
        }
      }

      // Obtener información de todas las agencias disponibles
      let usedExplicitAgencyChoice = false;
      if (allEmployees.length > 1) {
        const uniqueAgencyIds = [...new Set(allEmployees.map(emp => emp.agency_id))];
        const unionAgencyIds = [...new Set([...uniqueAgencyIds, ...membershipAgencyIds])];

        const agenciesList = (await listMyAgenciesDirectory()).filter(a =>
          unionAgencyIds.includes(a.agencyId),
        );
        setAvailableAgencies(agenciesList);

        const storageKey = `selected_agency_${user.id}`;

        if (urlAgencyFromQuery && membershipAgencyIds.includes(urlAgencyFromQuery)) {
          const urlEmployee = allEmployees.find(emp => emp.agency_id === urlAgencyFromQuery);
          if (urlEmployee) {
            selectedEmployee = urlEmployee;
          }
          localStorage.setItem(storageKey, urlAgencyFromQuery);
          usedExplicitAgencyChoice = true;
          console.debug('[AgencyContext] Usando agencia desde URL (membresía user_agencies):', urlAgencyFromQuery);
        } else {
          const savedAgencyId = localStorage.getItem(storageKey);
          if (savedAgencyId && membershipAgencyIds.includes(savedAgencyId)) {
            const savedEmployee = allEmployees.find(emp => emp.agency_id === savedAgencyId);
            if (savedEmployee) {
              selectedEmployee = savedEmployee;
              usedExplicitAgencyChoice = true;
              console.debug('[AgencyContext] Usando agencia guardada:', savedAgencyId);
            } else {
              usedExplicitAgencyChoice = true;
              console.debug('[AgencyContext] Agencia guardada solo en user_agencies (p. ej. impersonación):', savedAgencyId);
            }
          } else if (selectedEmployee?.agency_id) {
            localStorage.setItem(storageKey, selectedEmployee.agency_id);
            console.debug('[AgencyContext] Guardando agencia por defecto:', selectedEmployee.agency_id);
          }
        }
      } else {
        if (membershipAgencyIds.length > 1) {
          const agenciesList = (await listMyAgenciesDirectory()).filter(a =>
            membershipAgencyIds.includes(a.agencyId),
          );
          setAvailableAgencies(agenciesList);
        } else {
          setAvailableAgencies([]);
        }
      }

      const primaryMatchesMembership =
        !!primaryAgencyId && allEmployees.some(emp => emp.agency_id === primaryAgencyId);

      // No usar is_primary por encima de URL/localStorage: si no, al cambiar de agencia el contexto
      // seguía cargando la “primaria” y el planificador / Realtime parecían no aplicar cambios.
      const storageKeyAgency = `selected_agency_${user.id}`;
      const savedAgencyId =
        typeof window !== 'undefined' ? localStorage.getItem(storageKeyAgency) : null;
      const impersonationAgencyId = membershipRows.find((row) => row.is_impersonation === true)?.agency_id;
      let agencyIdToLoad: string | null = null;

      if (urlAgencyInMembership && urlAgencyFromQuery) {
        agencyIdToLoad = urlAgencyFromQuery;
        const empForUrl = allEmployees.find(emp => emp.agency_id === urlAgencyFromQuery);
        if (empForUrl) {
          selectedEmployee = empForUrl;
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKeyAgency, urlAgencyFromQuery);
        }
        console.debug('[AgencyContext] agencyIdToLoad priorizado por ?agency= en membresía:', urlAgencyFromQuery);
      } else if (
        savedAgencyId &&
        membershipAgencyIds.includes(savedAgencyId) &&
        !allEmployees.some((emp) => emp.agency_id === savedAgencyId)
      ) {
        agencyIdToLoad = savedAgencyId;
        console.debug('[AgencyContext] agencyIdToLoad: agencia guardada sin empleado (soporte):', savedAgencyId);
      } else if (
        impersonationAgencyId &&
        membershipAgencyIds.includes(impersonationAgencyId) &&
        !allEmployees.some((emp) => emp.agency_id === impersonationAgencyId)
      ) {
        agencyIdToLoad = impersonationAgencyId;
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKeyAgency, impersonationAgencyId);
        }
        console.debug('[AgencyContext] agencyIdToLoad: impersonación activa:', impersonationAgencyId);
      } else if (usedExplicitAgencyChoice) {
        if (savedAgencyId && membershipAgencyIds.includes(savedAgencyId)) {
          agencyIdToLoad = savedAgencyId;
          const empSaved = allEmployees.find(emp => emp.agency_id === savedAgencyId);
          if (empSaved) {
            selectedEmployee = empSaved;
          }
        } else if (selectedEmployee?.agency_id) {
          agencyIdToLoad = selectedEmployee.agency_id;
        }
      } else if (allEmployees.length > 1 && primaryMatchesMembership && primaryAgencyId) {
        agencyIdToLoad = primaryAgencyId;
      } else {
        agencyIdToLoad = selectedEmployee?.agency_id ?? primaryAgencyId ?? null;
      }

      if (agencyIdToLoad) {
        const empForLoad = allEmployees.find(emp => emp.agency_id === agencyIdToLoad);
        if (empForLoad) {
          selectedEmployee = empForLoad;
        }
        if (
          (allEmployees.length > 1 || membershipAgencyIds.length > 1 || urlAgencyInMembership) &&
          typeof window !== 'undefined'
        ) {
          localStorage.setItem(storageKeyAgency, agencyIdToLoad);
        }
      }

      if (primaryAgencyId && !allEmployees.some(emp => emp.agency_id === primaryAgencyId)) {
        const primaryFromDirectory = (await listMyAgenciesDirectory()).find(
          a => a.agencyId === primaryAgencyId,
        );
        if (primaryFromDirectory) {
          setAvailableAgencies(prev => {
            const has = prev.some(a => a.agencyId === primaryAgencyId);
            if (has) return prev;
            return [...prev, primaryFromDirectory];
          });
        }
      }

      // 2. Obtener la agencia por el agency_id a cargar (RPC: sanea secretos según rol)
      const { data: agencyData, error: agencyError } = await fetchAgencyRowForAppClient(agencyIdToLoad);

      if (agencyError || !agencyData) {
        console.error('[AgencyContext] Error obteniendo agencia:', agencyError?.message ?? agencyError);
        setError('No se pudo cargar la información de la agencia');
        setCurrentAgency(null);
        setIsSupportImpersonation(false);
        if (isInitialLoad) {
          setIsLoading(false);
        }
        return;
      }

      const agency = await mapSupabaseAgency(agencyData);
      const employeeAgencyIds = allEmployees.map((emp) => emp.agency_id);
      setIsSupportImpersonation(
        computeSupportImpersonation(agencyIdToLoad, membershipRows, employeeAgencyIds),
      );

      // Solo actualizar si la agencia cambió para evitar loops infinitos (incl. token Google Ads).
      // Incluir plan/suscripción: si no, cambios vía webhook (Stripe) no refrescan la UI aunque la BD esté bien.
      setCurrentAgency(prev => {
        if (prev?.id === agency.id &&
          JSON.stringify(prev.settings) === JSON.stringify(agency.settings) &&
          prev.google_ads_refresh_token === agency.google_ads_refresh_token &&
          prev.google_ads_customer_id === agency.google_ads_customer_id &&
          prev.meta_ads_access_token === agency.meta_ads_access_token &&
          prev.planId === agency.planId &&
          prev.subscriptionStatus === agency.subscriptionStatus &&
          prev.stripeCustomerId === agency.stripeCustomerId &&
          prev.stripeSubscriptionId === agency.stripeSubscriptionId &&
          prev.trialEndsAt === agency.trialEndsAt &&
          prev.subscriptionPeriodEndsAt === agency.subscriptionPeriodEndsAt &&
          prev.subscriptionCancelAtPeriodEnd === agency.subscriptionCancelAtPeriodEnd &&
          prev.trialUsedAt === agency.trialUsedAt) {
          return prev;
        }
        return agency;
      });

      isInitialLoadRef.current = false;

    } catch (err) {
      console.error('[AgencyContext] Error inesperado:', err);
      setError('Error al cargar la agencia');
      setCurrentAgency(null);
      setIsSupportImpersonation(false);
      isInitialLoadRef.current = false;
    } finally {
      // Asegurarnos de quitar el loading solo si lo pusimos (carga inicial)
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, [user]);

  // Cargar agencia cuando el usuario esté autenticado. Guarda con prevUserIdRef evita recargas
  // masivas cuando Supabase refresca el token o re-emite sesión al cambiar de pestaña.
  useEffect(() => {
    if (!isAuthInitialized) return;
    if (user?.id != null && currentAgency != null && user.id === prevUserIdRef.current) {
      return;
    }
    if (!user?.id) {
      prevUserIdRef.current = null;
    }
    repairAttemptedRef.current = false;
    fetchAgencyForUser();
    prevUserIdRef.current = user?.id ?? null;
  }, [isAuthInitialized, fetchAgencyForUser, user?.id, currentAgency]);

  const refreshAgency = useCallback(async () => {
    await fetchAgencyForUser();
  }, [fetchAgencyForUser]);

  // Marcar setup como completado (RPC evita UPDATE en 0 filas por RLS sin error en el cliente)
  const completeSetup = useCallback(async () => {
    if (!currentAgency?.id) return;

    const agencyId = currentAgency.id;

    const { error: rpcError } = await supabase.rpc('complete_agency_setup_for_client', {
      p_agency_id: agencyId,
    });

    if (rpcError) {
      const rpcMissing =
        rpcError.code === '42883' ||
        rpcError.message?.includes('complete_agency_setup_for_client');

      if (!rpcMissing) {
        console.error('[AgencyContext] Error completando setup (RPC):', rpcError);
        throw rpcError;
      }

      const { data, error: directError } = await supabase
        .from('agencies')
        .update({ setup_completed: true })
        .eq('id', agencyId)
        .select('id')
        .maybeSingle();

      if (directError || !data?.id) {
        console.error('[AgencyContext] Error completando setup (directo):', directError);
        throw new Error(
          directError?.message ||
            'No se pudo guardar la configuración inicial. ¿Aplicaste la migración complete_agency_setup_for_client?'
        );
      }
    }

    setCurrentAgency((prev) => (prev ? { ...prev, setupCompleted: true } : null));
  }, [currentAgency?.id]);

  // Actualizar nombre de agencia y regenerar slug
  const updateAgencyName = useCallback(async (name: string) => {
    if (!currentAgency?.id) return;

    // Generar slug a partir del nombre
    const newSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { error } = await supabase
      .from('agencies')
      .update({ name, slug: newSlug })
      .eq('id', currentAgency.id);

    if (error) {
      console.error('[AgencyContext] Error actualizando nombre:', error);
      throw error;
    }

    setCurrentAgency(prev => prev ? { ...prev, name, slug: newSlug } : null);
  }, [currentAgency?.id]);

  // Función para cambiar de agencia manualmente
  const switchAgency = useCallback(async (agencyId: string) => {
    if (!user?.id) return;

    // Guardar la preferencia en localStorage
    const storageKey = `selected_agency_${user.id}`;
    localStorage.setItem(storageKey, agencyId);

    // Recargar la agencia
    await fetchAgencyForUser();
  }, [user?.id, fetchAgencyForUser]);

  // ============================================
  // Funciones de gestión de miembros de agencia
  // ============================================

  // Obtener miembros de una agencia
  const getAgencyMembers = useCallback(async (agencyId: string): Promise<AgencyMember[]> => {
    return getAgencyMembersUtil(agencyId);
  }, []);

  // Eliminar usuario de una agencia
  const removeUserFromAgency = useCallback(
    async (userId: string, agencyId: string): Promise<{ completelyRemoved: boolean }> => {
      return removeUserFromAgencyUtil(userId, agencyId);
    },
    []
  );

  // Transferir propiedad de agencia
  const transferAgencyOwnership = useCallback(
    async (newOwnerId: string, agencyId: string): Promise<void> => {
      return transferAgencyOwnershipUtil(newOwnerId, agencyId);
    },
    []
  );

  const updateUserAgencyRole = useCallback(
    async (userId: string, agencyId: string, role: string, department?: string) => {
      const { error: empError } = await supabase
        .from('employees')
        .update({
          role: role || null,
          department: department ?? null,
        })
        .eq('user_id', userId)
        .eq('agency_id', agencyId);
      if (empError) throw new Error(empError.message);
      const { error: uaErr } = await supabase
        .from('user_agencies')
        .update({
          role: role || null,
          department: department ?? null,
        })
        .eq('user_id', userId)
        .eq('agency_id', agencyId);
      if (uaErr && uaErr.code !== '42P01') {
        console.warn('[AgencyContext] user_agencies update:', uaErr.message);
      }
      await fetchAgencyForUser();
    },
    [fetchAgencyForUser]
  );

  const inviteUserToAgency = useCallback(
    async (email: string, role?: string, department?: string) => {
      if (!user?.id) throw new Error('Debes iniciar sesión para invitar usuarios.');
      if (!currentAgency?.id) throw new Error('No hay agencia seleccionada.');
      const { data, error } = await supabase.functions.invoke('invite-user-to-agency', {
        body: {
          email: email.trim().toLowerCase(),
          agencyId: currentAgency.id,
          role: role ?? null,
          department: department ?? null,
        },
      });
      if (error) {
        let msg = error.message || 'Error al invitar';
        try {
          const ctx = error as { context?: Response };
          if (ctx.context && typeof ctx.context.json === 'function') {
            const j = await ctx.context.json();
            if (j?.error && typeof j.error === 'string') msg = j.error;
          }
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const body = data as { error?: string; employeeId?: string; userId?: string } | null;
      if (body?.error) throw new Error(body.error);
      await fetchAgencyForUser();
      return body;
    },
    [user?.id, currentAgency?.id, fetchAgencyForUser]
  );

  const value = {
    currentAgency,
    isLoading,
    error,
    isSupportImpersonation,
    refreshAgency,
    completeSetup,
    updateAgencyName,
    switchAgency,
    availableAgencies,
    userAgencies,
    getAgencyMembers,
    removeUserFromAgency,
    transferAgencyOwnership,
    inviteUserToAgency,
    updateUserAgencyRole,
    updateSettings: async (settings: Partial<AgencySettings>) => {
      if (!currentAgency?.id) return;

      const newSettings = normalizeAgencySettings({ ...currentAgency.settings, ...settings });

      const { data: savedSettings, error: rpcError } = await supabase.rpc(
        'update_agency_settings_for_client',
        { p_agency_id: currentAgency.id, p_settings: newSettings },
      );

      if (rpcError) {
        const { data: updated, error: directError } = await supabase
          .from('agencies')
          .update({ settings: newSettings })
          .eq('id', currentAgency.id)
          .select('settings')
          .maybeSingle();

        if (directError || !updated?.settings) {
          const hint =
            rpcError.code === '42883' || rpcError.message?.includes('update_agency_settings_for_client')
              ? ' Aplica la migración 20260522130000_agency_settings_update_permission en Supabase.'
              : '';
          throw new Error(
            (directError?.message || rpcError.message || 'No se pudo guardar la configuración de la agencia.') +
              hint,
          );
        }

        const merged = updated.settings as AgencySettings;
        setCurrentAgency((prev) => (prev ? { ...prev, settings: merged } : null));
      } else {
        const merged = (savedSettings as AgencySettings | null) ?? newSettings;
        setCurrentAgency((prev) => (prev ? { ...prev, settings: merged } : null));
      }

      await fetchAgencyForUser().catch(console.error);
    },
  };

  return <AgencyContext.Provider value={value}>{children}</AgencyContext.Provider>;
}

export function useAgency() {
  const context = useContext(AgencyContext);
  if (context === undefined) {
    throw new Error('useAgency must be used within an AgencyProvider');
  }
  return context;
}

export function useAgencySettings() {
  const { currentAgency } = useAgency();
  return currentAgency?.settings ?? null;
}

export function useAgencyModules() {
  const settings = useAgencySettings();
  return settings?.modules ?? null;
}

export function useUserAgencies() {
  const { userAgencies, availableAgencies } = useAgency();
  return { userAgencies, availableAgencies };
}

