# Contract: Player and organizer UI

These are the selectors and text that tests and people rely on.

## Roster (`renderRoster`)

- One `button[data-pick="<entryId>"]` per entry where `!removed`. There is no other filter (FR-300).
- The `<em>Every name is claimed.</em>` fallback is deleted. The roster is empty only if the draft has no live entries, and the "Add yourself" row is always there.
- Clicking a pick button sets `pick:<draftId>` in local storage and renders the player screen. It never fails, so it needs no roster error path. `rosterError` remains for `#add-name`.

## Player screen (`renderPlayer`)

- `#not-me` ("NOT YOU?") is **always** rendered (FR-303). Previously it was hidden once `score !== null`.
- Clicking `#not-me` returns to the roster immediately. There is no `confirm()`, no network call, and no error path.
- Everything else is unchanged: `#practice`, `#official`, `#free`, commit banners.

## Leaderboard (`statusOf`)

- The words `CLAIMED` and `UNCLAIMED` MUST NOT appear anywhere in the rendered board (FR-308).
- An entry with no runs of either kind reads `NOT STARTED`.

## Organizer panel (`renderOrganizer`)

- `[data-release]` is removed (FR-309).
- The State column is `COMMITTED <score>` or `NO SCORE YET`.
- `[data-remove]`, `#save-deadline` and `#reset` are unchanged.

## Removed text

- "Someone else just claimed that name."
- "Put <name> back on the list and pick again? … Anyone can claim that name after you do…"
- "Could not reach the draft to give the name back."
