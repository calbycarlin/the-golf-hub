import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Service-role client — bypasses RLS entirely. Only ever imported from
 * Route Handlers (app/api/**), after the caller's host token / other
 * authorization has been checked in that route. Never expose this client
 * or the underlying key to the browser.
 */
export function createAdminClient() {
  return createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false },
  });
}
