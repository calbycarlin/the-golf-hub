import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Anon-key client for use in the browser and in Server Components. There is
 * no auth session to manage (no accounts in this app), so this is a plain
 * client rather than the cookie-aware @supabase/ssr helpers. RLS restricts
 * it to SELECT everywhere, plus INSERT/UPDATE on hole_scores and INSERT on
 * photos — see supabase/migrations/0001_init.sql for the full policy.
 */
export function createPublicClient() {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false },
  });
}
