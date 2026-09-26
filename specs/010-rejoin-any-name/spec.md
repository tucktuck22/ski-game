# Feature Specification: Rejoin Any Name

**Feature Branch**: `claude/exciting-hawking-ad4qz9`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "when I, as a player, assign myself to a name, leave, and then come back in a subsequent session, I can't pick my name because it has been claimed. We do not need to have any kind of restrictions around claiming. Users should just be able to select themselves and back out if they errantly pick the wrong player. The failure mode here is that I can't come back in a subsequent session once I've already claimed myself once"

## Background

The draft today treats picking a name as an exclusive, one-time claim. The roster offers only names nobody has picked yet. The game remembers who a player is only until the browser session ends. After that, the player's own name is no longer offered: the roster already counts it as claimed, and nothing on the device remembers that it belongs to them. A player who closes the tab, or comes back the next day, or picks up a different phone, is locked out of their own entry. Only an organizer release gets them back in.

This contradicts two existing requirements of the draft (feature 001):

- **FR-010**: resume a player's identity automatically on the same device.
- **FR-011**: let a player resume on any other device by re-selecting their name.

Both are met only within a single browser session. This feature replaces exclusive claiming with open selection, which is how the draft already works in every other respect: the honor system is the security model.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Come back to my own name (Priority: P1)

A player picks their name, does some practice runs, and closes the game. Later, possibly in a new browser session or on a different device, they open the draft link again. They find their name on the roster, select it, and are back where they left off: the same practice and official runs remaining, and the same score if they already posted one.

**Why this priority**: This is the reported defect. A player who cannot get back to their own name cannot finish the competition. The only way out today is to find the organizer.

**Independent Test**: Pick a name, use one practice run, and end the browser session. Open the link fresh and select the same name. The name is offered, selecting it succeeds, and the practice count shows one used.

**Acceptance Scenarios**:

1. **Given** a player picked "Dave" in an earlier session and that session has ended, **When** they open the draft link and view the roster, **Then** "Dave" is listed and can be selected.
2. **Given** "Dave" has used 2 practice runs and 0 official attempts, **When** anyone selects "Dave", **Then** the player screen shows 1 practice run and every official attempt remaining.
3. **Given** "Dave" already has a committed official score, **When** anyone selects "Dave", **Then** selecting succeeds and the player screen shows that score, with no extra runs granted.
4. **Given** a player picked "Dave" on their phone, **When** they open the link on a laptop and select "Dave", **Then** selecting succeeds without any organizer action.

---

### User Story 2 - Back out of the wrong name (Priority: P1)

A player taps a name that is not theirs. They back out, return to the roster, and pick the right one. Backing out does not change the name they left, for anyone.

**Why this priority**: Without exclusive claims, a mis-tap costs nothing as long as the player can undo it right away. This is what makes open selection safe to rely on.

**Independent Test**: Select a wrong name, back out, and select the right one. The wrong name's run counts and score are unchanged, and it is still selectable.

**Acceptance Scenarios**:

1. **Given** a player has selected "Sam" by mistake, **When** they choose to back out, **Then** they return to the roster and "Sam" is still listed.
2. **Given** a player backed out of "Sam", **When** anyone views the leaderboard, **Then** "Sam"'s run counts, score and status are exactly as they were before.
3. **Given** "Sam" has a committed official score, **When** a player who selected "Sam" backs out, **Then** backing out is allowed and "Sam"'s score is unaffected.
4. **Given** a player is mid-run, **When** they look for a way to back out, **Then** it is not offered until the run ends.

---

### User Story 3 - Resume automatically on the same device (Priority: P2)

A player who picked a name on this device and did not back out opens the draft again later on the same device. They land directly on their player screen without re-selecting.

**Why this priority**: This is a convenience. With Story 1 in place, re-selecting takes one tap, so it is not required to unblock anyone. It is what FR-010 already promised.

**Independent Test**: Select a name, fully close the browser, reopen the draft link on the same device, and confirm the player screen shows that name without touching the roster.

**Acceptance Scenarios**:

1. **Given** a player selected "Marty" on this device and never backed out, **When** they reopen the draft link after the browser was closed, **Then** they are shown as "Marty" without selecting again.
2. **Given** a player backed out of "Marty" on this device, **When** they reopen the draft link, **Then** they see the roster, not "Marty".
3. **Given** the organizer removed "Marty" from the draft, **When** the device that last selected "Marty" reopens the link, **Then** it shows the roster and does not resume as "Marty".

---

### Edge Cases

- **Two people select the same name at the same time**: both are allowed. The name has one shared set of practice runs, official attempts and one score. Whatever either of them spends is spent for the name. This is an accepted consequence of the honor system, not something the game prevents.
- **Someone selects another player's name, deliberately or by mistake, and spends an official attempt**: the attempt is spent. The remedy is the organizer's existing removal of an unwanted score, as it is today for any honor-system abuse.
- **A removed name**: it is not offered on the roster, and no device resumes as it.
- **Selecting a name while offline or unable to reach the draft**: the player is told plainly that the draft could not be reached, and nothing changes.
- **A shared device (one laptop passed around)**: the next person sees the previous person's name. They back out and pick their own (Story 2).
- **Adding a new name**: unchanged. The creator is placed straight into the new entry, and the new name is selectable by anyone from then on.
- **After the draft is finalized**: names remain selectable so players can see their result. No runs become available that the draft's rules would not otherwise allow.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-300**: The roster MUST offer every name in the draft that has not been removed, whether or not anyone has selected it before.
- **FR-301**: Selecting a name MUST succeed without checking whether anyone else has selected it, now or earlier, and without requiring any organizer action.
- **FR-302**: Selecting a name MUST place the player into that name's existing state (practice runs used, official attempts used, committed score) with nothing reset and nothing added.
- **FR-303**: The player screen MUST offer a way to back out of the selected name at any time the player is not mid-run, including after that name has a committed score.
- **FR-304**: Backing out MUST return the player to the roster and MUST NOT change the name's run counts, score, standing, or availability to anyone.
- **FR-305**: A device MUST remember the name its player last selected across browser sessions, and resume it automatically on return (FR-010), until the player backs out or the name is removed.
- **FR-306**: A device MUST NOT resume as a name that has been removed from the draft; it MUST show the roster instead.
- **FR-307**: Run limits (practice runs, official attempts) and the committed score MUST continue to belong to the name, not to the device or session. Selecting a name from several devices MUST NOT multiply the runs available to it.
- **FR-308**: The draft MUST NOT hold any notion of a name being claimed, taken, or owned. No roster, leaderboard, or organizer view may show a name as claimed or unclaimed, and nothing may treat a name as unavailable because it has been selected before.
- **FR-309**: Recovering from a wrong or stranded selection MUST NOT require the organizer. The organizer's RELEASE control MUST be removed, since there is nothing left for it to release.

This feature supersedes FR-008's "exactly one unclaimed name" restriction, FR-012 (claim races) and FR-092 (release only until commit) from feature 001, where they conflict with the requirements above.

### Key Entities

- **Roster name (entry)**: a competitor in the draft. It owns its practice runs used, official attempts used, and best committed score. It may be removed by the organizer. It has no owner and no claimed state.
- **Device selection**: which name this device is currently playing as. It is local to the device, survives the browser closing, and is cleared by backing out or by the name's removal.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A player who picked a name and ended their session can get back to that name in 2 taps or fewer after opening the link, on the same device or a different one, in 100% of attempts.
- **SC-002**: The organizer is asked to release or unlock a name 0 times during a draft.
- **SC-003**: A player who selected the wrong name gets to the right one in under 10 seconds, with no change visible on the leaderboard for the wrong name.
- **SC-004**: At the next play pass, every tester can leave, return in a new session, and resume their own entry with no help.

## Assumptions

- The honor system remains the security model (feature 001: "The honor system is the security model"). Nothing stops one player from selecting another player's name. The group accepts this, as it already accepted that anyone could claim any unclaimed name.
- "Back out" is the existing "NOT YOU?" control, now available after a score is committed as well. It only affects the device it is pressed on.
- Claiming and releasing are removed as concepts, not merely relaxed (maintainer decision, 2026-09-26). Selecting a name is a choice this device makes and nothing else sees. A name with no runs yet reads as not started, not as unclaimed.
- Sign-in or any per-person identity is out of scope. It is the right answer for a less casual setting, where a person's entry should be theirs alone, and would be a separate feature that replaces the honor system rather than amending it.
- Same-device resume across sessions uses whatever local memory the device already offers. If that memory is unavailable (private browsing, cleared site data), the player re-selects from the roster, which FR-300 and FR-301 guarantee will work.
