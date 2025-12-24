// supabase/functions/create-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Manejo de CORS (Preflight request)
  // Esto soluciona el error "Response to preflight request doesn't pass access control check"
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Crear cliente de Supabase con permisos de SUPERADMIN (Service Role)
    // Estas variables de entorno se inyectan automáticamente en Supabase Edge Functions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Leer los datos que envía el frontend
    const { email, password, name } = await req.json()

    if (!email || !password) {
        throw new Error("Email y contraseña son obligatorios")
    }

    console.log(`Intentando crear usuario: ${email}`)

    // 4. Crear el usuario en el sistema de Auth
    const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Confirmamos el email automáticamente para que pueda entrar ya
      user_metadata: { full_name: name }
    })

    if (authError) {
        console.error("Error Auth:", authError)
        throw authError
    }

    // 5. Devolver el ID del usuario creado al frontend
    return new Response(
      JSON.stringify({ user: user.user }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error("Error general:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
