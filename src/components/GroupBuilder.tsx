import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import type { GroupBuilderState, GroupDraft } from "@/lib/draftTypes";

const UNASSIGNED = -1;

/**
 * Groups-first player entry: pick the number of groups, then add players
 * directly into each group's card (name + handicap + Player A), rather
 * than maintaining one long flat roster with a group-picker dropdown per
 * row. A player can still be moved to a different group via a small
 * inline selector, and removed groups don't delete their players — they
 * fall back to an "Unassigned" card so nothing is silently lost.
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

  function movePlayer(playerIndex: number, groupIndex: number) {
    updatePlayer(playerIndex, { groupIndex, isPlayerA: false });
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
                    groups={groups}
                    currentGroupIndex={gi}
                    onNameChange={(name) => updatePlayer(p.index, { name })}
                    onHandicapChange={(handicap) => updatePlayer(p.index, { handicap })}
                    onPlayerAChange={() => setPlayerA(p.index, gi)}
                    onMove={(target) => movePlayer(p.index, target)}
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
          <p className="text-xs text-navy/40">Not currently in a group — move them into one below.</p>
          <div className="mt-3 flex flex-col gap-2">
            {unassigned.map((p) => (
              <PlayerRow
                key={p.index}
                name={p.name}
                handicap={p.handicap}
                isPlayerA={false}
                groups={groups}
                currentGroupIndex={UNASSIGNED}
                onNameChange={(name) => updatePlayer(p.index, { name })}
                onHandicapChange={(handicap) => updatePlayer(p.index, { handicap })}
                onMove={(target) => movePlayer(p.index, target)}
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
  groups,
  currentGroupIndex,
  onNameChange,
  onHandicapChange,
  onPlayerAChange,
  onMove,
  onRemove,
}: {
  name: string;
  handicap: number;
  isPlayerA: boolean;
  radioGroupName?: string;
  groups: GroupDraft[];
  currentGroupIndex: number;
  onNameChange: (name: string) => void;
  onHandicapChange: (handicap: number) => void;
  onPlayerAChange?: () => void;
  onMove: (groupIndex: number) => void;
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
      <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Player name" className="min-w-0 flex-[3]" />
      <NumberField
        value={handicap}
        onChange={onHandicapChange}
        min={0}
        max={54}
        className="h-[46px] w-16 flex-1 text-base"
        ariaLabel="Playing handicap"
      />
      <select
        value={currentGroupIndex}
        onChange={(e) => onMove(Number(e.target.value))}
        className="shrink-0 rounded-lg border border-navy/15 bg-white px-2 py-2 text-xs"
        aria-label="Move to group"
      >
        <option value={-1}>Unassigned</option>
        {groups.map((g, gi) => (
          <option key={gi} value={gi}>
            {g.name || `Group ${gi + 1}`}
          </option>
        ))}
      </select>
      <button type="button" onClick={onRemove} className="shrink-0 p-2 text-navy/40 hover:text-red-600" aria-label="Remove player">
        ✕
      </button>
    </div>
  );
}
