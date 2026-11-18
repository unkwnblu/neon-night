import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// The project URL isn't secret, so either name works.
const url = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

export function isSupabaseConfigured() {
  return Boolean(url() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Server-side client using the service role key. It bypasses row level
 * security, so it must never be imported into a client component.
 */
export function supabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  client ??= createClient(url()!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
