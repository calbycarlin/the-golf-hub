import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import type { GroupBuilderState, GroupDraft } from "@/lib/draftTypes";

const UNASSIGNED = -1;

/**
 * Groups-first player entry: pick the number of groups, then add players
 * directly into each group's card (name + handicap + Player A), rather
 * than maintaining one long flat roster with a group-picker dropdown per
 * row. There's no cross-group "move" control by design — reassigning a
 * player means removing and re-adding them in the right group, which
 * keeps each row down to just what it needs on a small screen. Removed
 * groups don't delete their players — they fall back to an "Unassigned"
 * card so nothing is silently lost.
 */
export function GroupBuilder({
  state,
  onChange,
}: {
  state: GroupBuilderState;
  onChange: (state: GroupBuilderState) => void;
}) {
  const { groups, players } = state;

  function setNumGroups(n: number) {
    const clamped = Math.max(1, n);
    const nextGroups = [...groups];
    while (nextGroups.length < clamped) {
      nextGroups.push({ name: `Group ${nextGroups.length + 1}`, teeTime: "" });
    }
    const removedFrom = clamped;
    const trimmedGroups = nextGroups.slice(0, clamped);
    const nextPlayers = players.map((p) =>
      p.groupIndex >= removedFrom ? { ...p, groupIndex: UNASSIGNED, isPlayerA: false } : p
    );
    onChange({ groups: trimmedGroups, players: nextPlayers });
  }

  function updateGroup(groupIndex: number, patch: Partial<GroupDraft>) {
    onChange({ ...state, groups: groups.map((g, i) => (i === groupIndex ? { ...g, ...patch } : g)) });
  }

  function addPlayer(groupIndex: number) {
    onChange({ ...state, players: [...players, { name: "", handicap: 0, groupIndex, isPlayerA: false }] });
  }

  function updatePlayer(playerIndex: number, patch: Partial<GroupBuilderState["players"][number]>) {
    onChange({ ...state, players: players.map((p, i) => (i === playerIndex ? { ...p, ...patch } : p)) });
  }

  function removePlayer(playerIndex: number) {
    onChange({ ...state, players: players.filter((_, i) => i !== playerIndex) });
  }

  function setPlayerA(playerIndex: number, groupIndex: number) {
    onChange({
      ...state,
      players: players.map((p, i) =>
        p.groupIndex === groupIndex ? { ...p, isPlayerA: i === playerIndex } : p
      ),
    });
  }

  const unassigned = players
    .map((p, i) => ({ ...p, index: i }))
    .filter((p) => p.groupIndex === UNASSIGNED);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Label className="mb-0">Number of groups</Label>
        <NumberField min={1} max={40} value={groups.length} onChange={setNumGroups} className="w-16 text-base" ariaLabel="Number of groups" />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {groups.map((g, gi) => {
          const groupPlayers = players.map((p, i) => ({ ...p, index: i })).filter((p) => p.groupIndex === gi);
          return (
            <div key={gi} className="rounded-xl border border-navy/10 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={g.name}
                  onChange={(e) => updateGroup(gi, { name: e.target.value })}
                  className="max-w-[10rem] font-semibold"
                />
                <Input
                  type="time"
                  value={g.teeTime}
                  onChange={(e) => updateGroup(gi, { teeTime: e.target.value })}
                  className="w-32"
                  aria-label="Tee time"
                />
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {groupPlayers.map((p) => (
                  <PlayerRow
                    key={p.index}
                    name={p.name}
                    handicap={p.handicap}
                    isPlayerA={p.isPlayerA}
                    radioGroupName={`playerA-${gi}`}
                    onNameChange={(name) => updatePlayer(p.index, { name })}
                    onHandicapChange={(handicap) => updatePlayer(p.index, { handicap })}
                    onPlayerAChange={() => setPlayerA(p.index, gi)}
                    onRemove={() => removePlayer(p.index)}
                  />
                ))}
                {groupPlayers.length === 0 && <p className="text-sm text-navy/40">No players in this group yet</p>}
              </div>

              <Button type="button" variant="outline" size="md" className="mt-3" onClick={() => addPlayer(gi)}>
                + Add Player to {g.name || `Group ${gi + 1}`}
              </Button>
            </div>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-navy/20 p-3">
          <p className="font-semibold text-navy/60">Unassigned</p>
          <p className="text-xs text-navy/40">Not currently in a group — remove and re-add them under the right one.</p>
          <div className="mt-3 flex flex-col gap-2">
            {unassigned.map((p) => (
              <PlayerRow
                key={p.index}
                name={p.name}
                handicap={p.handicap}
                isPlayerA={false}
                onNameChange={(name) => updatePlayer(p.index, { name })}
                onHandicapChange={(handicap) => updatePlayer(p.index, { handicap })}
                onRemove={() => removePlayer(p.index)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({
  name,
  handicap,
  isPlayerA,
  radioGroupName,
  onNameChange,
  onHandicapChange,
  onPlayerAChange,
  onRemove,
}: {
  name: string;
  handicap: number;
  isPlayerA: boolean;
  radioGroupName?: string;
  onNameChange: (name: string) => void;
  onHandicapChange: (handicap: number) => void;
  onPlayerAChange?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {onPlayerAChange && (
        <input
          type="radio"
          name={radioGroupName}
          checked={isPlayerA}
          onChange={onPlayerAChange}
          aria-label={`Mark ${name || "this player"} as Player A`}
          className="shrink-0"
        />
      )}
      <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Player name" className="min-w-0 flex-1" />
      <NumberField
        value={handicap}
        onChange={onHandicapChange}
        min={0}
        max={54}
        className="h-[46px] w-14 shrink-0 text-base"
        ariaLabel="Playing handicap"
      />
      <button type="button" onClick={onRemove} className="shrink-0 p-2 text-navy/40 hover:text-red-600" aria-label="Remove player">
        ✕
      </button>
    </div>
  );
}
