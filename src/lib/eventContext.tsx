"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/client";
import { getStoredHostToken, storeHostToken } from "@/lib/hostToken";
import type { EventRow } from "@/lib/supabase/types";

interface EventContextValue {
  eventId: string;
  event: EventRow | null;
  loading: boolean;
  notFound: boolean;
  isHost: boolean;
  hostToken: string | null;
  refresh: () => void;
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ eventId, children }: { eventId: string; children: React.ReactNode }) {
  const searchParams = useSearchParams();
  // Derived synchronously from the URL/localStorage on first render, so this
  // never needs an effect + setState of its own.
  const [hostToken, setHostToken] = useState<string | null>(() => {
    const fromQuery = searchParams.get("host");
    return fromQuery || getStoredHostToken(eventId);
  });
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // Persisting to localStorage is the actual side effect here; re-deriving
    // `hostToken` itself already happened in the lazy initializer above (or
    // via the branch below, when the query param shows up after mount).
    const fromQuery = searchParams.get("host");
    if (fromQuery) {
      storeHostToken(eventId, fromQuery);
      // Keeps host state in sync if a host link with a token is opened
      // after the initial mount (e.g. client-side navigation).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHostToken((current) => (current === fromQuery ? current : fromQuery));
    }
  }, [eventId, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createPublicClient();

    supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setNotFound(true);
        } else {
          setEvent(data as EventRow);
        }
        setLoading(false);
      });

    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${eventId}` },
        (payload) => {
          if (!cancelled) setEvent(payload.new as EventRow);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [eventId, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ eventId, event, loading, notFound, isHost: !!hostToken, hostToken, refresh }),
    [eventId, event, loading, notFound, hostToken, refresh]
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEvent must be used within an EventProvider");
  return ctx;
}
