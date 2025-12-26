// supabase/functions/create-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      console.error('Variables de entorno faltantes:', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseServiceKey 
      })
      throw new Error('Configuración del servidor incompleta. Contacta al administrador.')
    }

    // 3. Crear cliente de Supabase con permisos de SUPERADMIN (Service Role)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 4. Leer y validar los datos que envía el frontend
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error('Error parseando JSON:', parseError)
      throw new Error('Formato de datos inválido. Verifica que los datos se envíen correctamente.')
    }

    const { email, password, name } = body

    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new Error('El email es obligatorio y debe ser una cadena de texto válida')
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new Error('La contraseña es obligatoria y debe tener al menos 6 caracteres')
    }

    console.log(`Intentando crear usuario: ${email}`)

    // 5. Crear el usuario en el sistema de Auth
    const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true, // Confirmamos el email automáticamente para que pueda entrar ya
      user_metadata: { full_name: name || email }
    })

    if (authError) {
      console.error("Error Auth:", authError)
      
      // Mensajes de error más descriptivos
      if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
        throw new Error('Este email ya está registrado. Usa otro email o inicia sesión.')
      } else if (authError.message?.includes('invalid')) {
        throw new Error('El formato del email no es válido.')
      } else {
        throw new Error(authError.message || 'Error al crear el usuario en el sistema de autenticación.')
      }
    }

    if (!user?.user?.id) {
      console.error('No se recibió user.id del sistema de Auth')
      throw new Error('No se pudo crear el usuario. El sistema no devolvió un ID válido.')
    }

    console.log(`Usuario creado exitosamente: ${user.user.id}`)

    // 6. Devolver el ID del usuario creado al frontend
    return new Response(
      JSON.stringify({ user: user.user }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error("Error general:", error)
    const errorMessage = error?.message || 'Error desconocido al crear usuario'
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
