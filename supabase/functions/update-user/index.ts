import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, password, email } = await req.json()

    if (!userId) throw new Error("User ID is required")

    const updates: any = {}
    if (password && password.length >= 6) updates.password = password
    if (email) updates.email = email
    if (email) updates.email_confirm = true // Auto-confirmar cambio de email

    // Actualizamos el usuario en Auth
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates)

    if (error) throw error

    return new Response(JSON.stringify({ user: data.user }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})
