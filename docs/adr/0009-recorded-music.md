# 9. Music may be recorded; sound effects stay synthesised

**Status**: Accepted
**Date**: 2026-09-04
**Deciders**: tucktuck22
**Relates to**: style-bible rules A-1, A-2, A-5;
[feature 003](../../specs/003-recorded-music-tracks/spec.md) FR-147;
[ADR-0006](0006-platform-baseline-and-budgets.md) payload budget

## Context

Style-bible rule A-1 read, until today:

> All audio is synthesised at runtime via Web Audio (FR-053). No sampled or licensed
> material of any kind.

That was not an accident or an omission. The class comment in `src/audio/synth.ts`
argues for it in three separate ways: everything is original by construction, so
FR-053 cannot be violated by mistake; it costs kilobytes rather than the megabytes an
audio file would take out of the 2 MB payload budget; and it is how the music of the
period was actually made. A-2 backed it with a fixed instrument set — two pulse leads,
one triangle bass, one noise percussion.

The project owner then supplied two original recorded pieces and asked for them to
replace the synthesised music: "Look Out Below" for the screens outside a run, "Powder
Rush" for the course. Both are original works the project owns.

Three ratified rules stood in the way. FR-053 and O-1 forbid third-party musical
material, which the pieces' provenance satisfies without amendment. A-1 and A-2 forbid
sampled audio outright, which nothing satisfies — they had to change or the feature
had to be abandoned.

## Decision

**A-1 is split by kind of audio.**

Sound effects remain synthesised at runtime, without exception. The reasoning that
built A-1 still holds for them, and one part of it is load-bearing in a way it is not
for music: a cue carries gameplay information (A-4) and must fire the instant the
event happens. A file that has not finished downloading cannot do that. Cues are also
where the originality argument is cheapest to keep, since nobody is tempted to source
a wipeout noise from elsewhere.

Music may be an original recorded piece. **A-2 is scoped rather than weakened**: its
instrument set governs synthesis, which is what it was always describing. A recorded
piece is outside A-2, not in breach of it.

**A-5 is added**: a recorded music asset must cite a provenance record in
`assets/audio/README.md` establishing it as an original work the project owns. This is
the replacement for what A-1 used to provide free. Synthesis made originality
structural — you cannot accidentally sample someone when you only have oscillators.
Recorded audio makes it a claim, and FR-052 requires every asset to cite the rule it
satisfies at review, so the claim needs somewhere to live and someone to have made it.

**The payload half of A-1's argument is answered by the feature, not by this ADR.**
The masters are 7.09 MiB against a 2 MB gzipped initial-payload ceiling. Feature 003
re-encodes to mono ~96 kbps (~3.5 MiB for the pair) and fetches both on demand, so
neither enters the initial payload. ADR-0006's budget is unchanged and unamended.

## Consequences

**What gets better.** Recorded music is simply better music than four oscillators can
make, and the pieces were already written. The game gains a soundtrack rather than a
loop.

**What gets worse.** Three things, stated plainly rather than discovered later:

1. **Originality is now a claim, not a property.** A-5 exists because of this. It is
   weaker than what A-1 gave, and it depends on a human having told the truth in
   `assets/audio/README.md`.
2. **Audio can now fail to load.** Synthesis could not. Feature 003 answers this with
   FR-143 — a failure or delay must degrade to silence and never block a run — but the
   failure mode is new and it is silent, which makes it hard to notice.
3. **Bytes.** ~3.5 MiB where there were none. It stays out of the initial payload, but
   a player on a slow connection now waits for music that used to be instant.

**What is now under-enforced.** A-1's synthesis rule was self-enforcing: there was no
loader, so there could be no sample. Now there is a loader, and nothing mechanical
stops a future change from routing a sound effect through it. That is a gap in the
gate, not in the rule. Nobody should treat A-1's sound-effect clause as protected the
way it used to be.

## Alternatives considered

**Keep A-1 and abandon the feature.** The strongest case for it is the payload
argument, which was real. It loses because the pieces exist, are original, and are
better than what synthesis produces — and because lazy loading answers the payload
objection without touching the budget.

**Keep A-1 and record a deviation instead of amending.** Faster, and it was offered.
Rejected: a deviation is for something you intend to fix, and there is no intention to
go back to synthesised music. Feature 002 already carries an unresolved Principle I
deviation, and adding a permanent one for a decision that is actually settled would
make the deviation list mean less.

**Amend A-1 to permit recorded audio generally, cues included.** Simpler as a rule —
one kind of audio, one policy. Rejected on A-4: a cue that has not downloaded yet is a
cue that does not fire, and the visible equivalent would be carrying the information
alone at exactly the moment the player needed both.
