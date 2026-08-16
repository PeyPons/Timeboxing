// supabase/functions/register-agency/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { sendWelcomeOrInvitationEmail } from "../_shared/welcome-and-invitation-email.ts"
import { sendRegistrationAdminNotify } from "../_shared/registration-admin-notify.ts"
import {
    INPUT_LIMITS,
    parseBoundedString,
    parseEmail,
    parsePassword,
} from "../_shared/input-limits.ts"
import {
    assertRateLimit,
    getClientIp,
    RATE_LIMITS,
    RateLimitError,
    RateLimitUnavailableError,
} from "../_shared/rate-limit.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generar slug a partir del nombre de la empresa
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
        .replace(/[^a-z0-9\s-]/g, '') // Solo alfanuméricos
        .replace(/\s+/g, '-') // Espacios a guiones
        .replace(/-+/g, '-') // Múltiples guiones a uno
        .trim();
}

serve(async (req) => {
    // 1. Manejo de CORS (Preflight request)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 2. Validar variables de entorno
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Configuración del servidor incompleta.')
        }

        // 3. Cliente con permisos de admin
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // 4. Leer datos
        let body
        try {
            body = await req.json()
        } catch {
            throw new Error('Formato de datos inválido.')
        }

        const clientIp = getClientIp(req)
        await assertRateLimit(
            supabaseAdmin,
            `register:ip:${clientIp}`,
            RATE_LIMITS.registerByIp,
            true,
        )

        const { email, password, name, agencyName, currency: bodyCurrency } = body

        const ALLOWED_CURRENCIES = new Set([
            'EUR', 'USD', 'GBP', 'MXN', 'ARS', 'COP', 'CLP', 'PEN', 'BRL',
            'CAD', 'CHF', 'UYU', 'BOB', 'PYG', 'CRC', 'GTQ', 'DOP',
        ])
        const agencyCurrency =
            typeof bodyCurrency === 'string' && ALLOWED_CURRENCIES.has(bodyCurrency.toUpperCase())
                ? bodyCurrency.toUpperCase()
                : 'EUR'

        const cleanEmail = parseEmail(email)
        await assertRateLimit(
            supabaseAdmin,
            `register:email:${cleanEmail}`,
            RATE_LIMITS.registerByEmail,
            true,
        )

        const cleanPassword = parsePassword(password)
        const cleanName = parseBoundedString(name, {
            min: 2,
            max: INPUT_LIMITS.personName,
            fieldName: 'Nombre',
        })
        const cleanAgencyName = parseBoundedString(agencyName, {
            min: 2,
            max: INPUT_LIMITS.agencyName,
            fieldName: 'Nombre de la empresa',
        })

        console.log(`Registrando: ${cleanEmail} para agencia "${cleanAgencyName}"`)

        // 5. Verificar que el email no exista ya
        const { data: existingEmployee, error: checkError } = await supabaseAdmin
            .from('employees')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle()

        // Si hay un error que no sea "no encontrado", lanzarlo
        if (checkError && checkError.code !== 'PGRST116') {
            console.error("Error verificando email:", checkError)
            throw new Error('Error al verificar el email. Inténtalo de nuevo.')
        }

        if (existingEmployee) {
            throw new Error('Este email ya está registrado en Taimbox. Inicia sesión o usa otro email.')
        }

        // 6. Crear usuario en Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: cleanPassword,
            email_confirm: true,
            user_metadata: { full_name: cleanName }
        })

        if (authError) {
            console.error("Error Auth:", authError)
            if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
                throw new Error('Este email ya está registrado. Inicia sesión o usa otro email.')
            }
            throw new Error(authError.message || 'Error al crear cuenta de acceso.')
        }

        if (!authData?.user?.id) {
            throw new Error('No se pudo crear el usuario.')
        }

        const userId = authData.user.id
        console.log(`Usuario Auth creado: ${userId}`)

        // 7. Crear agencia
        const slug = generateSlug(cleanAgencyName)
        let finalSlug = slug
        let attempt = 0
        const maxAttempts = 5

        // Intentar encontrar un slug único
        while (attempt < maxAttempts) {
            const { data: existingAgency, error: slugCheckError } = await supabaseAdmin
                .from('agencies')
                .select('id')
                .eq('slug', finalSlug)
                .maybeSingle()

            // Si hay un error que no sea "no encontrado", lanzarlo
            if (slugCheckError && slugCheckError.code !== 'PGRST116') {
                console.error("Error verificando slug:", slugCheckError)
                throw new Error('Error al verificar el slug. Inténtalo de nuevo.')
            }

            if (!existingAgency) {
                break // Slug disponible
            }

            // Si existe, probar con sufijo numérico aleatorio corto
            attempt++
            finalSlug = `${slug}-${Math.floor(100 + Math.random() * 900)}`
        }

        const { data: agencyData, error: agencyError } = await supabaseAdmin
            .from('agencies')
            .insert({
                name: cleanAgencyName,
                slug: finalSlug,
                settings: {
                    ownerUserId: userId,
                    currency: agencyCurrency,
                    // Módulos mínimos; el onboarding guía el resto según plan (PLAN_MODULES)
                    modules: {
                        deadlines: true,
                        timeTracker: true,
                    },
                    projectFilters: [],
                    roles: [{
                        name: 'Administrador',
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
                            can_access_agency_settings: true
                        }
                    }],
                    departments: [],
                    branding: {},
                    features: {},
                    integrations: {} // Objeto para claves API
                },
                setup_completed: false,
                plan_id: 'business',
                subscription_status: 'trialing',
                trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                trial_used_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (agencyError) {
            console.error("Error creando agencia:", agencyError)
            // Rollback: eliminar usuario de Auth
            await supabaseAdmin.auth.admin.deleteUser(userId)

            if (agencyError.code === '23505' && agencyError.message?.includes('agencies_name_unique')) {
                throw new Error('El nombre de la empresa ya existe. Por favor elige otro.')
            }

            throw new Error('Error al crear la empresa. Inténtalo de nuevo.')
        }

        console.log(`Agencia creada: ${agencyData.id}`)

        // 8. Crear empleado admin vinculado
        // Asignar automáticamente el rol "Administrador" que se creó en los settings
        const adminRole = 'Administrador'; // Rol fijo que siempre existe
        const temporaryDepartment = 'General'; // Departamento temporal - se actualizará en el onboarding

        const { data: employeeData, error: employeeError } = await supabaseAdmin
            .from('employees')
            .insert({
                agency_id: agencyData.id,
                name: cleanName,
                email: cleanEmail,
                user_id: userId,
                role: adminRole,
                department: temporaryDepartment,
                default_weekly_capacity: 40,
                work_schedule: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 },
                is_active: true,
                hourly_rate: 0
            })
            .select()
            .single()

        if (employeeError) {
            console.error("Error creando empleado:", employeeError)
            // Rollback
            await supabaseAdmin.from('agencies').delete().eq('id', agencyData.id)
            await supabaseAdmin.auth.admin.deleteUser(userId)
            throw new Error('Error al crear el perfil. Inténtalo de nuevo.')
        }

        console.log(`Empleado creado: ${employeeData.id}`)

        // 9. Crear relación en user_agencies (nuevo sistema de múltiples agencias)
        // Verificar si la tabla existe antes de insertar
        const { error: userAgencyError } = await supabaseAdmin
            .from('user_agencies')
            .insert({
                user_id: userId,
                agency_id: agencyData.id,
                role: adminRole,
                department: temporaryDepartment,
                is_primary: true // Primera agencia = primaria
            })

        if (userAgencyError) {
            // Si la tabla no existe aún, solo loguear el error pero no fallar
            // Esto permite compatibilidad con instalaciones que aún no tienen la migración
            console.warn("Error creando relación user_agencies (puede que la tabla no exista aún):", userAgencyError)
            // No hacemos rollback porque el sistema antiguo sigue funcionando
        } else {
            console.log(`Relación user_agencies creada para usuario ${userId} y agencia ${agencyData.id}`)
        }

        // 10. Email de bienvenida vía Resend (misma vía que request-password-reset: sin fetch a otra función)
        try {
            const emailResult = await sendWelcomeOrInvitationEmail(supabaseAdmin, {
                email: cleanEmail,
                name: cleanName,
                agencyName: cleanAgencyName,
                type: 'registration',
            })
            if (!emailResult.success) {
                console.warn(`No se pudo enviar email de bienvenida a ${cleanEmail}:`, emailResult.error)
            }
        } catch (emailError) {
            console.warn(`No se pudo enviar email de bienvenida a ${cleanEmail}:`, emailError)
        }

        // 10b. Aviso interno al administrador (no bloquea el registro)
        try {
            const notifyResult = await sendRegistrationAdminNotify({
                userName: cleanName,
                userEmail: cleanEmail,
                agencyName: cleanAgencyName,
                agencySlug: finalSlug,
                agencyId: agencyData.id,
                userId,
                currency: agencyCurrency,
                planId: agencyData.plan_id ?? 'business',
            })
            if (!notifyResult.success) {
                console.warn(`No se pudo enviar aviso de registro a admin:`, notifyResult.error)
            }
        } catch (notifyError) {
            console.warn('Error enviando aviso de registro a admin:', notifyError)
        }

        // 11. Retornar datos para auto-login
        return new Response(
            JSON.stringify({
                success: true,
                user: authData.user,
                agency: agencyData,
                employee: employeeData
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error: unknown) {
        console.error("Error general:", error)

        const errorMessage = error instanceof Error ? error.message : 'Error desconocido al registrar'
        const status = error instanceof RateLimitError
            ? 429
            : error instanceof RateLimitUnavailableError
                ? 503
            : error instanceof Error && errorMessage.includes('supera')
                ? 400
                : 400

        return new Response(
            JSON.stringify({
                error: errorMessage,
                details: Deno.env.get('NODE_ENV') === 'development' && error instanceof Error ? error.stack : undefined
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status
            }
        )
    }
})
