import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyHostToken } from "./codes";
import type { EventRow } from "./supabase/types";

export class HostAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Loads the event and throws a HostAuthError (404/403) if the token doesn't match. */
export async function requireHostToken(
  admin: SupabaseClient,
  eventId: string,
  hostToken: string | null
): Promise<EventRow> {
  const { data: event, error } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw new HostAuthError(error.message, 500);
  if (!event) throw new HostAuthError("Event not found", 404);

  if (!hostToken || !verifyHostToken(hostToken, event.host_token_hash)) {
    throw new HostAuthError("Invalid or missing host token", 403);
  }

  return event as EventRow;
}
