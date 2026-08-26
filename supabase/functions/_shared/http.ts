// =====================================================================
//  http.ts — barcha Edge Function uchun umumiy HTTP yordamchilari.
// =====================================================================

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  return null;
}

/** Supabase platformasi bu uchtasini o'zi beradi — qo'lda sozlash shart emas. */
export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
export const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
export const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
