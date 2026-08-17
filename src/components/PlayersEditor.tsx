import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import type { PlayerDraft } from "@/lib/draftTypes";

export function PlayersEditor({
  players,
  onChange,
}: {
  players: PlayerDraft[];
  onChange: (players: PlayerDraft[]) => void;
}) {
  function updatePlayer(index: number, patch: Partial<PlayerDraft>) {
    onChange(players.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPlayer() {
    onChange([...players, { name: "", handicap: 0 }]);
  }

  function removePlayer(index: number) {
    onChange(players.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex flex-col gap-2">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={p.name}
              onChange={(e) => updatePlayer(i, { name: e.target.value })}
              placeholder={`Player ${i + 1} name`}
              className="min-w-0 flex-[3]"
            />
            <NumberField
              value={p.handicap}
              onChange={(handicap) => updatePlayer(i, { handicap })}
              min={0}
              max={54}
              className="h-[46px] w-16 flex-1 text-base"
              ariaLabel="Playing handicap"
            />
            <button
              type="button"
              onClick={() => removePlayer(i)}
              className="p-2 text-navy/40 hover:text-red-600"
              aria-label="Remove player"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="md" className="mt-3" onClick={addPlayer}>
        + Add Player
      </Button>
    </div>
  );
}
