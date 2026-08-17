"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createPublicClient } from "@/lib/supabase/client";
import { normalizeJoinCode } from "@/lib/joinCode";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeJoinCode(code);
    if (!normalized) {
      setError("Enter a join code");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const supabase = createPublicClient();
      const { data, error: dbError } = await supabase
        .from("events")
        .select("id")
        .eq("join_code", normalized)
        .maybeSingle();

      if (dbError) throw dbError;
      if (!data) {
        setError("We couldn't find an event with that code. Double-check with your host and try again.");
        return;
      }

      router.push(`/event/${data.id}`);
    } catch {
      setError("Something went wrong looking up that code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-offwhite">
      <Container className="flex flex-1 flex-col justify-center">
        <Link href="/" className="mb-6 text-sm font-semibold text-navy/60">
          ← Back
        </Link>
        <Card>
          <h1 className="text-2xl font-bold text-navy">Join an Event</h1>
          <p className="mt-1 text-sm text-navy/60">Enter the join code your host shared with you.</p>

          <form onSubmit={handleSubmit} className="mt-6">
            <Label htmlFor="code">Join Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(normalizeJoinCode(e.target.value))}
              placeholder="e.g. 7KQPXR"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              maxLength={6}
              inputMode="text"
              className="text-center text-2xl font-bold tracking-[0.3em]"
              autoFocus
            />
            {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

            <Button type="submit" variant="accent" size="lg" className="mt-6 w-full" disabled={loading}>
              {loading ? "Looking up…" : "Join"}
            </Button>
          </form>
        </Card>
      </Container>
    </main>
  );
}
