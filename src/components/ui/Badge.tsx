import type { EventStatus } from "@/lib/supabase/types";

const statusConfig: Record<EventStatus, { label: string; className: string }> = {
  setup: { label: "Setup", className: "bg-navy/10 text-navy" },
  in_progress: { label: "In Progress", className: "bg-accent/20 text-navy" },
  complete: { label: "Complete", className: "bg-green-100 text-green-800" },
};

export function StatusBadge({ status }: { status: EventStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${config.className}`}
    >
      {status === "in_progress" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      )}
      {config.label}
    </span>
  );
}
