"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CameraIcon } from "@/components/ui/icons";
import { createPublicClient } from "@/lib/supabase/client";
import { useEvent } from "@/lib/eventContext";
import { formatDeletionDate, getRetentionDays } from "@/lib/retention";
import type { PhotoRow } from "@/lib/supabase/types";

const NAME_KEY = "golfhub:uploaderName";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — matches the gallery bucket's file_size_limit
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"]);

export default function GalleryPage() {
  const { eventId, event } = useEvent();
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploaderName, setUploaderName] = useState(() =>
    typeof window === "undefined" ? "" : (window.localStorage.getItem(NAME_KEY) ?? "")
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("photos")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setPhotos((data as PhotoRow[]) ?? []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    // Fetch-on-mount: setState happens after the awaits inside `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const supabase = createPublicClient();
    const channel = supabase
      .channel(`gallery-${eventId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "photos", filter: `event_id=eq.${eventId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, load]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setError(null);

    if (file.size > MAX_FILE_BYTES) {
      setError("That photo is too large (max 10MB) — try a smaller one.");
      return;
    }
    // Some mobile browsers leave `type` blank for HEIC/HEIF, so fall back
    // to the file extension rather than reject a genuine phone photo.
    const ext = file.name.split(".").pop()?.toLowerCase();
    const looksLikeImage = file.type
      ? ALLOWED_TYPES.has(file.type)
      : ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"].includes(ext ?? "");
    if (!looksLikeImage) {
      setError("That doesn't look like a photo — please choose an image file.");
      return;
    }

    setUploading(true);
    window.localStorage.setItem(NAME_KEY, uploaderName);

    try {
      const supabase = createPublicClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${eventId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("gallery").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("gallery").getPublicUrl(path);

      const { error: insertError } = await supabase.from("photos").insert({
        event_id: eventId,
        url: publicUrlData.publicUrl,
        storage_path: path,
        uploaded_by_name: uploaderName.trim() || null,
      });
      if (insertError) throw insertError;

      await load();
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Container>
      <h1 className="text-xl font-bold text-navy">Gallery</h1>
      <p className="mt-1 text-sm text-navy/60">Share photos from the day — anyone with the join code can add one.</p>
      {event && (
        <p className="mt-1 text-xs text-navy/40">
          Photos are automatically deleted {getRetentionDays()} days after the{" "}
          {event.event_date ? "event date" : "event was created"} — on {formatDeletionDate(event)}. Save any
          you&rsquo;d like to keep.
        </p>
      )}

      <Card className="mt-4">
        <Input
          value={uploaderName}
          onChange={(e) => setUploaderName(e.target.value)}
          placeholder="Your name (optional)"
          className="mb-3"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
        />
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <CameraIcon className="h-5 w-5" />
          {uploading ? "Uploading…" : "Add a Photo"}
        </Button>
        {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
      </Card>

      {loading ? (
        <p className="mt-4 text-navy/50">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="mt-6 text-center text-sm text-navy/40">No photos yet — be the first to add one.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-navy/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URLs, no known domain set at build time for next/image */}
              <img src={photo.url} alt={photo.uploaded_by_name ?? "Event photo"} className="h-full w-full object-cover" loading="lazy" />
              {photo.uploaded_by_name && (
                <span className="absolute bottom-0 left-0 right-0 truncate bg-navy/60 px-2 py-1 text-[10px] text-white">
                  {photo.uploaded_by_name}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
