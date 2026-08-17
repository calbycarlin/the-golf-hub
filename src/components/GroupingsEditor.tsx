import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { GroupDraft, PlayerDraft } from "@/lib/draftTypes";

export interface GroupingsState {
  groups: GroupDraft[];
  assignments: number[]; // per player (by index into `players`), group index or -1
  playerA: number[]; // per group, player index that is Player A
}

export function GroupingsEditor({
  players,
  state,
  onChange,
}: {
  players: PlayerDraft[];
  state: GroupingsState;
  onChange: (state: GroupingsState) => void;
}) {
  const { groups, assignments, playerA } = state;

  function setNumGroups(n: number) {
    const clamped = Math.max(1, Math.min(Math.max(players.length, 1), n));
    const nextGroups = [...groups];
    while (nextGroups.length < clamped) nextGroups.push({ name: `Group ${nextGroups.length + 1}`, teeTime: "" });
    const trimmedGroups = nextGroups.slice(0, clamped);
    const nextPlayerA = [...playerA];
    while (nextPlayerA.length < clamped) nextPlayerA.push(-1);
    const trimmedPlayerA = nextPlayerA.slice(0, clamped);
    const nextAssignments = assignments.map((g) => (g >= clamped ? -1 : g));
    onChange({ groups: trimmedGroups, assignments: nextAssignments, playerA: trimmedPlayerA });
  }

  function autoSplit() {
    const numGroups = groups.length || 1;
    const nextAssignments = players.map((_, i) => i % numGroups);
    const firstOfGroup: number[] = Array(numGroups).fill(-1);
    players.forEach((_, i) => {
      const g = nextAssignments[i];
      if (firstOfGroup[g] === -1) firstOfGroup[g] = i;
    });
    onChange({ groups, assignments: nextAssignments, playerA: firstOfGroup });
  }

  function updateGroup(index: number, patch: Partial<GroupDraft>) {
    onChange({ ...state, groups: groups.map((g, i) => (i === index ? { ...g, ...patch } : g)) });
  }

  function setAssignment(playerIndex: number, groupIndex: number) {
    onChange({ ...state, assignments: assignments.map((v, i) => (i === playerIndex ? groupIndex : v)) });
  }

  function setPlayerA(groupIndex: number, playerIndex: number) {
    onChange({ ...state, playerA: playerA.map((v, i) => (i === groupIndex ? playerIndex : v)) });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Label className="mb-0">Number of groups</Label>
        <Input
          type="number"
          min={1}
          max={Math.max(1, players.length)}
          value={groups.length}
          onChange={(e) => setNumGroups(Number(e.target.value))}
          className="w-20 text-center"
        />
        <Button type="button" variant="outline" size="md" onClick={autoSplit}>
          Auto-split evenly
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {groups.map((g, gi) => (
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
              {players.map((p, pi) =>
                !p.name.trim() ? null : (
                  <div key={pi} className="flex items-center justify-between gap-2 text-sm">
                    <label className="flex flex-1 items-center gap-2">
                      <input
                        type="radio"
                        name={`playerA-${gi}`}
                        checked={playerA[gi] === pi && assignments[pi] === gi}
                        onChange={() => setPlayerA(gi, pi)}
                        disabled={assignments[pi] !== gi}
                      />
                      <span className={assignments[pi] === gi ? "text-navy" : "text-navy/30"}>
                        {p.name}
                        {playerA[gi] === pi && assignments[pi] === gi && (
                          <span className="ml-1.5 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase text-navy">
                            Player A
                          </span>
                        )}
                      </span>
                    </label>
                    <select
                      value={assignments[pi]}
                      onChange={(e) => setAssignment(pi, Number(e.target.value))}
                      className="rounded-lg border border-navy/15 bg-white px-2 py-1 text-xs"
                    >
                      <option value={-1}>Unassigned</option>
                      {groups.map((gg, ggi) => (
                        <option key={ggi} value={ggi}>
                          {gg.name || `Group ${ggi + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
