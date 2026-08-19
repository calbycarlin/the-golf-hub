import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { LogoMark, TrophyIcon } from "@/components/ui/icons";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-navy px-4 py-16 text-white">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-20 items-center justify-center rounded-2xl bg-accent text-navy">
          <LogoMark className="h-11 w-auto" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">The Golf Hub</h1>
        <p className="mt-3 text-balance text-white/70">
          Set up players and groups, enter scores on the course, and watch the leaderboard update live.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <LinkButton href="/join" variant="accent" size="lg" className="w-full">
            Join an Event
          </LinkButton>
          <LinkButton href="/create" variant="outline" size="lg" className="w-full !border-white !bg-transparent !text-white hover:!bg-white/10">
            Create an Event
          </LinkButton>
        </div>

        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-white/50">
          <TrophyIcon className="h-3.5 w-3.5" />
          No accounts. Just a code.
        </p>

        <Link href="/privacy" className="mt-4 inline-block text-xs text-white/40 underline hover:text-white/60">
          Privacy notice
        </Link>
      </div>
    </main>
  );
}
