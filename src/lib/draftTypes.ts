export interface GroupDraft {
  id?: string;
  name: string;
  teeTime: string;
}

export interface GroupedPlayerDraft {
  id?: string;
  name: string;
  handicap: number;
  /** Index into the sibling `groups` array, or -1 if not yet assigned to a group. */
  groupIndex: number;
  /** Whether this player is Player A for whichever group they're currently in. */
  isPlayerA: boolean;
}

export interface GroupBuilderState {
  groups: GroupDraft[];
  players: GroupedPlayerDraft[];
}
