// Standard CORS headers for Supabase Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specify your frontend origin e.g. 'http://localhost:3000'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}; 