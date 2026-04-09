import { createClient } from '@supabase/supabase-js';
import { API_BASE_URL } from '@/config';

// Supabase URL is public, safe to hardcode
const supabaseUrl = 'https://hiarbjpgiwxcyinhmzyo.supabase.co';

let supabaseClient: ReturnType<typeof createClient> | null = null;
let serviceRoleKeyCache: string | null = null;

/**
 * Fetch the Supabase service role key from the backend.
 */
async function getServiceKey(): Promise<string> {
  if (serviceRoleKeyCache) return serviceRoleKeyCache;

  const response = await fetch(`${API_BASE_URL}/config/supabase`);
  if (!response.ok) {
    throw new Error('Failed to fetch Supabase config from backend');
  }
  const data = await response.json();
  if (!data.serviceRoleKey) {
    throw new Error('Supabase service role key not returned from backend');
  }
  serviceRoleKeyCache = data.serviceRoleKey;
  return data.serviceRoleKey;
}

/**
 * Get or initialize the Supabase client.
 */
export async function getSupabaseClient(): Promise<ReturnType<typeof createClient>> {
  if (supabaseClient) return supabaseClient;

  const serviceKey = await getServiceKey();
  supabaseClient = createClient(supabaseUrl, serviceKey);
  return supabaseClient;
}
