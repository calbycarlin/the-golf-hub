import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";

export const metadata = {
  title: "Privacy Notice — The Golf Hub",
};

export default function PrivacyPage() {
  return (
    <main className="flex-1 bg-offwhite">
      <Container className="max-w-xl">
        <Link href="/" className="mb-6 inline-block text-sm font-semibold text-navy/60">
          ← Back
        </Link>

        <h1 className="text-2xl font-bold text-navy">Privacy Notice</h1>
        <p className="mt-2 text-sm text-navy/60">
          The Golf Hub is a simple tool for running a golf day with a group of friends or a society. Here&rsquo;s a plain
          summary of what data it holds and who can see it.
        </p>

        <Card className="mt-6 flex flex-col gap-5 text-sm text-navy/80">
          <div>
            <h2 className="font-bold text-navy">What&rsquo;s collected</h2>
            <p className="mt-1">
              Event and course names, dates, group names and tee times, player names and playing handicaps, hole-by-hole
              scores, and any photos (plus an optional name) uploaded to the gallery.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy">Who enters it</h2>
            <p className="mt-1">
              The event host adds player names and handicaps when setting up an event. If you&rsquo;re hosting, only add
              people who are comfortable with their name, scores and any photos being visible to everyone else with
              the join code.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy">Who can see it</h2>
            <p className="mt-1">
              There are no accounts or passwords. Anyone with an event&rsquo;s join code can view its groupings, scores,
              leaderboard, results and photo gallery, and can enter scores or upload photos. Editing event details is
              restricted to the host&rsquo;s device via a separate host link.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy">How long it&rsquo;s kept</h2>
            <p className="mt-1">
              Event data isn&rsquo;t deleted automatically — it stays until the host removes it. If you&rsquo;d like your
              information taken down, ask the person who hosted the event, since they&rsquo;re the one who can edit or
              delete it.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy">Where it&rsquo;s stored</h2>
            <p className="mt-1">Data is stored in a Supabase-hosted database and file storage, accessed over HTTPS.</p>
          </div>

          <div>
            <h2 className="font-bold text-navy">Tracking</h2>
            <p className="mt-1">
              No analytics, tracking cookies, or advertising of any kind. The only things saved to your device are the
              host access for events you&rsquo;ve created and small local preferences (like your name for photo uploads).
            </p>
          </div>
        </Card>
      </Container>
    </main>
  );
}
