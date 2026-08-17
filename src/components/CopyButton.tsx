"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — nothing more we can do
    }
  }

  return (
    <Button type="button" variant="outline" size="md" onClick={handleCopy} className={className}>
      {copied ? "Copied!" : label}
    </Button>
  );
}
