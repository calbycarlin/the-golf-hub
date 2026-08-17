import { Suspense } from "react";
import { EventProvider } from "@/lib/eventContext";
import { EventHeader } from "@/components/EventHeader";

export default async function EventLayout({ children, params }: LayoutProps<"/event/[id]">) {
  const { id } = await params;

  return (
    <Suspense>
      <EventProvider eventId={id}>
        <div className="flex min-h-full flex-1 flex-col bg-offwhite">
          <EventHeader />
          <div className="flex-1">{children}</div>
        </div>
      </EventProvider>
    </Suspense>
  );
}
