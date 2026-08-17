export interface QueuedScore {
  playerId: string;
  holeNumber: number;
  strokes: number | null;
}

interface StoredQueuedScore extends QueuedScore {
  updatedAt: number;
}

function key(groupId: string) {
  return `golfhub:scoreQueue:${groupId}`;
}

export function readQueue(groupId: string): StoredQueuedScore[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(groupId));
    return raw ? (JSON.parse(raw) as StoredQueuedScore[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(groupId: string, queue: StoredQueuedScore[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(groupId), JSON.stringify(queue));
}

/** Adds/replaces a pending write, keeping only the latest value per player+hole. */
export function enqueueScore(groupId: string, entry: QueuedScore) {
  const queue = readQueue(groupId).filter(
    (q) => !(q.playerId === entry.playerId && q.holeNumber === entry.holeNumber)
  );
  queue.push({ ...entry, updatedAt: Date.now() });
  writeQueue(groupId, queue);
}

export function dequeueScore(groupId: string, playerId: string, holeNumber: number) {
  const queue = readQueue(groupId).filter((q) => !(q.playerId === playerId && q.holeNumber === holeNumber));
  writeQueue(groupId, queue);
}
