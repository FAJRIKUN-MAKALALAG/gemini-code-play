import { createClient } from '@supabase/supabase-js';
import { API_BASE_URL } from '@/config';

// Supabase URL is public, safe to hardcode
const supabaseUrl = 'https://hiarbjpgiwxcyinhmzyo.supabase.co';

let supabaseClient: ReturnType<typeof createClient> | null = null;
let anonKeyCache: string | null = null;

/**
 * Fetch the Supabase anon key from the backend.
 * The anon key is safe to expose to the public client.
 */
async function getAnonKey(): Promise<string> {
  if (anonKeyCache) return anonKeyCache;

  const response = await fetch(`${API_BASE_URL}/config/supabase`);
  if (!response.ok) {
    throw new Error('Failed to fetch Supabase config from backend');
  }
  const data = await response.json();
  if (!data.anonKey) {
    throw new Error('Supabase anon key not returned from backend');
  }
  anonKeyCache = data.anonKey;
  return data.anonKey;
}

/**
 * Get or initialize the Supabase client.
 * Resolves lazily after fetching the anon key from the backend.
 */
export async function getSupabaseClient(): Promise<ReturnType<typeof createClient>> {
  if (supabaseClient) return supabaseClient;

  const anonKey = await getAnonKey();
  supabaseClient = createClient(supabaseUrl, anonKey);
  return supabaseClient;
}
