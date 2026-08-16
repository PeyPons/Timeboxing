// supabase/functions/create-agency/index.ts
// Crea una agencia adicional para un usuario ya autenticado (multi-agencia).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AgencyAccessError,
  getAuthenticatedCaller,
  getBearerToken,
} from "../_shared/auth-user-access.ts";
import {
  INPUT_LIMITS,
  parseBoundedString,
} from "../_shared/input-limits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

const ADMIN_ROLE = "Administrador";
const DEFAULT_DEPARTMENT = "General";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Configuración del servidor incompleta.");
    }

    const bearer = getBearerToken(req);
    if (!bearer) {
      return new Response(JSON.stringify({ error: "No se proporcionó token de autorización" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const caller = await getAuthenticatedCaller({
      supabaseUrl,
      supabaseAnonKey,
      token: bearer,
    });

    let body: { agencyName?: string; currency?: string };
    try {
      body = await req.json();
    } catch {
      throw new Error("Formato de datos inválido.");
    }

    const cleanAgencyName = parseBoundedString(body.agencyName, {
      min: 2,
      max: INPUT_LIMITS.agencyName,
      fieldName: "Nombre de la empresa",
    });

    const ALLOWED_CURRENCIES = new Set([
      "EUR", "USD", "GBP", "MXN", "ARS", "COP", "CLP", "PEN", "BRL",
      "CAD", "CHF", "UYU", "BOB", "PYG", "CRC", "GTQ", "DOP",
    ]);
    const agencyCurrency =
      typeof body.currency === "string" && ALLOWED_CURRENCIES.has(body.currency.toUpperCase())
        ? body.currency.toUpperCase()
        : "EUR";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const userId = caller.id;
    const userEmail = caller.email?.toLowerCase() ?? "";
    const userName =
      (typeof caller.user_metadata?.full_name === "string" && caller.user_metadata.full_name.trim()) ||
      userEmail.split("@")[0] ||
      "Usuario";

    const { data: existingByName } = await supabaseAdmin
      .from("agencies")
      .select("id")
      .ilike("name", cleanAgencyName)
      .maybeSingle();

    if (existingByName) {
      throw new Error("El nombre de la empresa ya existe. Por favor elige otro.");
    }

    const slug = generateSlug(cleanAgencyName);
    let finalSlug = slug;
    let attempt = 0;
    while (attempt < 5) {
      const { data: existingSlug } = await supabaseAdmin
        .from("agencies")
        .select("id")
        .eq("slug", finalSlug)
        .maybeSingle();
      if (!existingSlug) break;
      attempt++;
      finalSlug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const { count: existingAgencyCount } = await supabaseAdmin
      .from("user_agencies")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const isFirstAgency = (existingAgencyCount ?? 0) === 0;

    const { data: agencyData, error: agencyError } = await supabaseAdmin
      .from("agencies")
      .insert({
        name: cleanAgencyName,
        slug: finalSlug,
        settings: {
          ownerUserId: userId,
          currency: agencyCurrency,
          modules: { deadlines: true, timeTracker: true },
          projectFilters: [],
          roles: [{
            name: ADMIN_ROLE,
            permissions: {
              can_access_planner: true,
              can_access_projects: true,
              can_access_clients: true,
              can_access_team: true,
              can_access_team_capacity: true,
              can_access_reports: true,
              can_access_client_reports: true,
              can_access_google_ads: true,
              can_access_meta_ads: true,
              can_access_ads_reports: true,
              can_access_deadlines: true,
              can_access_okrs: true,
              can_access_weekly_forecast: true,
              can_access_weekly: true,
              can_access_settings: true,
              can_access_agency_settings: true,
            },
          }],
          departments: [],
          branding: {},
          features: {},
          integrations: {},
        },
        setup_completed: false,
        plan_id: "business",
        subscription_status: "trialing",
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        trial_used_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (agencyError) {
      console.error("Error creando agencia:", agencyError);
      throw new Error("Error al crear la empresa. Inténtalo de nuevo.");
    }

    const { data: employeeData, error: employeeError } = await supabaseAdmin
      .from("employees")
      .insert({
        agency_id: agencyData.id,
        name: userName,
        email: userEmail,
        user_id: userId,
        role: ADMIN_ROLE,
        department: DEFAULT_DEPARTMENT,
        default_weekly_capacity: 40,
        work_schedule: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 },
        is_active: true,
        hourly_rate: 0,
      })
      .select()
      .single();

    if (employeeError) {
      await supabaseAdmin.from("agencies").delete().eq("id", agencyData.id);
      console.error("Error creando empleado:", employeeError);
      throw new Error("Error al crear el perfil en la nueva agencia.");
    }

    const { error: userAgencyError } = await supabaseAdmin
      .from("user_agencies")
      .insert({
        user_id: userId,
        agency_id: agencyData.id,
        role: ADMIN_ROLE,
        department: DEFAULT_DEPARTMENT,
        is_primary: isFirstAgency,
      });

    if (userAgencyError) {
      console.warn("Error creando user_agencies:", userAgencyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        agency: agencyData,
        employee: employeeData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: unknown) {
    console.error("Error create-agency:", error);
    const status = error instanceof AgencyAccessError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Error desconocido al crear la agencia";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
