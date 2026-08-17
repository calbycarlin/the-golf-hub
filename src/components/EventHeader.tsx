"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEvent } from "@/lib/eventContext";
import { StatusBadge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/CopyButton";

const TABS = [
  { href: "", label: "Hub" },
  { href: "/groupings", label: "Groupings" },
  { href: "/scorecards", label: "Scorecards" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/results", label: "Results" },
  { href: "/gallery", label: "Gallery" },
];

export function EventHeader() {
  const { event, loading, notFound, eventId, isHost } = useEvent();
  const pathname = usePathname();

  if (notFound) {
    return (
      <header className="bg-navy px-4 py-6 text-center text-white">
        <p className="font-semibold">Event not found</p>
        <Link href="/" className="mt-2 inline-block text-sm text-white/70 underline">
          Back to home
        </Link>
      </header>
    );
  }

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{loading ? "Loading…" : event?.name}</h1>
            <p className="truncate text-sm text-white/60">{event?.course_name}</p>
          </div>
          {event && <StatusBadge status={event.status} />}
        </div>

        {event && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Join Code</p>
              <p className="font-mono text-lg font-bold tracking-widest">{event.join_code}</p>
            </div>
            <div className="flex items-center gap-2">
              {isHost && (
                <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase text-navy">
                  Host
                </span>
              )}
              <CopyButton text={event.join_code} label="Copy" />
            </div>
          </div>
        )}
      </div>

      <nav className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
        {TABS.map((tab) => {
          const href = `/event/${eventId}${tab.href}`;
          const active = pathname === href;
          return (
            <Link
              key={tab.href}
              href={href}
              className={`shrink-0 rounded-t-lg px-3 py-2 text-sm font-semibold ${
                active ? "bg-offwhite text-navy" : "text-white/70 hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
