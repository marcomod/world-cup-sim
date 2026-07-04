Data Model

Purpose

This document describes the core entities used throughout the World Cup Simulator.

The data model should remain simple, explicit, and independent from the UI.

Simulator logic should operate on these structures rather than React components.

⸻

Design Principles

- Prefer explicit types.
- Avoid unnecessary nesting.
- Use IDs instead of object references where practical.
- Keep entities immutable whenever possible.
- Favor composition over inheritance.
- Simulator functions should accept and return well-defined objects.

⸻

Team

Represents a national team.

export type TeamId = string;
export interface Team {
id: TeamId;
name: string;
abbreviation: string;
flagUrl?: string;
confederation?: string;
}

Example:

{
id: "arg",
name: "Argentina",
abbreviation: "ARG"
}

⸻

Team Rating

Stores the numerical strength of a team.

export interface TeamRating {
teamId: TeamId;
modelVersion?: "v1" | "v2";
overall: number;
attack: number;
defense: number;
recentForm?: number;
squadStrength?: number;
penalties?: number;
}

Notes

The current probability model uses `overall` directly. `overall` is an Elo-style scalar calibrated for the existing rating-difference formula.

Attack and defense ratings are normalized 0-100 values, where higher is better. Current manual ratings may use distinct attack and defense values. Future generated baseline snapshots may use Elo-derived compatibility proxies, which should not be treated as independent measurements until separate source data exists.

Additional rating components may be introduced later.

⸻

Team Rating V2

Represents the current static team-strength snapshot.

export interface TeamRatingV2 extends TeamRating {
modelVersion: "v2";
recentForm: number;
squadStrength: number;
penalties: number;
}

V2 field scales:

- overall: Elo-style team strength used by matchup probabilities.
- attack: normalized 0-100 attacking strength.
- defense: normalized 0-100 defensive strength.
- recentForm: normalized 0-100 recent performance signal.
- squadStrength: normalized 0-100 squad quality signal.
- penalties: normalized 0-100 penalty ability signal currently used by V3 penalty shootout simulation.

The V2 data source is a static manual snapshot. It is not live sourced, scraped, or automatically updated.

⸻

Tournament Round

export type TournamentRound =
| "round_of_32"
| "round_of_16"
| "quarterfinal"
| "semifinal"
| "final";

⸻

2026 Group Stage

The product tournament layer represents the official 48-team format separately
from the knockout simulator:

export type GroupId = "A" | "B" | ... | "L";

export interface GroupStageMatch {
id: string;
group: GroupId;
homeTeamId: TeamId;
awayTeamId: TeamId;
status: "scheduled" | "completed";
result: { homeGoals: number; awayGoals: number } | null;
}

export interface GroupTableRow {
teamId: TeamId;
group: GroupId;
played: number;
wins: number;
draws: number;
losses: number;
goalsFor: number;
goalsAgainst: number;
goalDifference: number;
points: number;
}

`RankedGroupTeam` adds a group position and the tie-break stages used for the
ranking. `ThirdPlacedTeam` adds cross-group third-place rank and qualification
status.

Round-of-32 slot definitions are static data. They describe sources such as
`1A`, `2B`, or a third-placed team from an eligible group set. Generated
Round-of-32 matches retain source metadata for auditability before being adapted
to the existing simulator `Match[]` shape.

The 2026 tournament layer also defines:

- `RankingMode`, which distinguishes official ranking from explicit
  development fallback behavior.
- `FairPlayRecord`, where an explicit zero deduction is valid and a missing
  record remains missing.
- `FifaRankingRecord`, where lower numerical rank is better and records are
  used only for the final official tie-break criterion when earlier criteria
  cannot resolve a tie.
- `ThirdPlaceAssignment`, the static Annex C mapping from a canonical
  eight-group key to the eight third-place Round-of-32 slots.
- `KnockoutTopologyMatch`, the canonical progression from `m73` through the
  final `m104`, including explicit winner and loser advancement. Semifinal
  losers advance to the third-place match `m103`; semifinal winners advance to
  the final `m104`. The current simulator adapter consumes only champion-path
  winner links.

The official 2026 snapshot now has checked-in derived artifacts:

- `data/world-cup-2026/snapshots/official-2026-current/qualification.json`
- `data/world-cup-2026/snapshots/official-2026-current/round-of-32.json`
- `data/world-cup-2026/snapshots/official-2026-current/knockout-results.json`
- `data/generated/world-cup-2026/official-rating-linkage.json`
- `data/generated/world-cup-2026/official-simulator-input.json`

The qualification artifact records `BDEFIJKL`, 32 unique qualifiers, eight
qualified third-placed teams, and Ecuador/Ghana as a shared-rank equivalence
group at rank 3. It does not serialize a strict official ordering between them
and does not include fabricated fair-play totals. The simulator-input artifact
contains the 31-match champion path with populated `m73`-`m88` openers and
unresolved later-round participants. The app surfaces this official artifact
state separately from the development simulation sandbox.

The knockout-results artifact is generated from
`data/world-cup-2026/sources/official-knockout-results.json`. The source file is
offline and manually edited when real knockout matches become official. The
generated artifact records:

- schema and artifact versions,
- tournament snapshot, qualification, Round-of-32, and topology checksums,
- fixed source metadata and source-access timestamp,
- `completedMatches`, where winners are official locks,
- `pendingMatches`, where participants are either known from official results
  or represented as unresolved source slots,
- a semantic `resultChecksum`.

Completed knockout rows include the match ID, participant A/B, official score,
winner, result status, result source, extra-time/penalty flags, and topology
derived winner routing. Pending rows include the match ID, source slots, known
participants if already determined, unresolved participant slots, and
`status: "pending"`.

The mixed official/simulated adapter prepares a champion-path `Match[]` where
completed official matches are locked and pending matches remain simulatable.
Official winners are propagated into future slots before unresolved matches are
simulated. The adapter delegates pending match outcomes to the existing
simulator functions and does not alter probability math or rating values.

⸻

2026 Tournament Snapshot

The local snapshot layer represents versioned source data before it is adapted
into the tournament domain.

export interface TournamentSnapshot {
schemaVersion: string;
snapshotId: string;
snapshotVersion: string;
tournament: "fifa-world-cup-2026";
state:
| "structure_only"
| "group_stage_in_progress"
| "group_stage_complete";
teams: readonly SnapshotTeam[];
fixtures: readonly SnapshotFixture[];
fairPlay: readonly SnapshotFairPlayRecord[];
fifaRanking: readonly SnapshotFifaRankingRecord[];
sources: TournamentSnapshotSources;
}

Snapshot validation derives the actual state from fixture statuses, validates
all teams and fixtures, normalizes ordering, and records a semantic checksum.
The Node loader is not imported by React or the simulator engine.

⸻

Match Score

Represents the final score of a simulated match.

export interface MatchScore {
teamAGoals: number;
teamBGoals: number;
decidedBy:
| "regular_time"
| "extra_time"
| "penalties";
teamAPenalties?: number;
teamBPenalties?: number;
}

Penalty shootout goals are stored separately from match goals. A match decided by penalties keeps tied match goals and stores the shootout result in `teamAPenalties` and `teamBPenalties`.

⸻

Match

Represents a single fixture.

export interface Match {
id: string;
round: TournamentRound;
teamAId: TeamId | null;
teamBId: TeamId | null;
winnerId?: TeamId;
score?: MatchScore;
}

⸻

Match Simulation Result

Returned by simulateMatch().

export interface MatchSimulationResult {
winnerId: TeamId;
loserId: TeamId;
teamAWinProbability: number;
teamBWinProbability: number;
score?: MatchScore;
}

Scoreline simulation is optional. When it is omitted, match simulation results include only the winner, loser, and matchup probabilities.

⸻

Tournament Simulation Result

Returned by simulateBracket().

export interface TournamentSimulationResult {
championId: TeamId;
matches: Match[];
}

⸻

Tournament Odds

Represents probabilities accumulated by Monte Carlo simulations.

export interface TeamTournamentOdds {
teamId: TeamId;
roundOf16Probability: number;
quarterfinalProbability: number;
semifinalProbability: number;
finalProbability: number;
championProbability: number;
}

All probabilities are values between 0 and 1.

UI components may convert them to percentages.

⸻

Initial Bracket

The initial bracket is fixed.

Example:

export interface InitialBracket {
matches: Match[];
}

The simulator should never mutate the original bracket.

Simulation functions should operate on copies.

⸻

Random Number Generator

Randomness should be centralized.

export interface RNG {
next(): number;
}

The RNG should return a number in the interval:

[0, 1)

Seedable implementations are preferred.

⸻

Relationships

Team
↓
TeamRating
Team
↓
Match
Match
↓
MatchSimulationResult
MatchSimulationResult
↓
TournamentSimulationResult
TournamentSimulationResult
↓
Monte Carlo Engine
Monte Carlo Engine
↓
Tournament Odds

⸻

Future Extensions

The model should support:

- Group-stage simulation
- Player-level ratings
- Injuries
- Goalkeeper ratings
- Host advantage
- Historical validation
- Market values
- Tactical adjustments

Future additions should extend existing entities rather than replacing them whenever possible.

⸻

World Cup 2026 Official Snapshot

`TournamentSnapshot` stores the local official tournament data: 48 teams, groups
A through L, 72 group fixtures, completed results when available, fair-play
records when sourced, FIFA-ranking tie-break records, source references, schema
version, snapshot ID, snapshot version, and declared state.

For the official 2026 snapshot, `SnapshotTeam.name` stores the FIFA source
display name. Product-friendly local names remain ingestion metadata and must
not be conflated with official source names.

The official snapshot artifacts are generated under
`data/world-cup-2026/snapshots/official-2026-current/`. Source extracts live
under `data/world-cup-2026/raw/official-2026-current/` and are checksum-verified
before snapshot construction.

`KnockoutRatingSnapshot` is a versioned offline rating artifact linked to a
specific tournament snapshot checksum. It contains exactly 48
`KnockoutRatingRecord` rows with pre-tournament rating, group-stage delta, and
knockout rating. It also records K-factor policy metadata, initial-rating source
metadata, completed match count, and fixture range. It is not the active app
rating export.

`fair-play-source-gap.json` is a raw-source review artifact, not a tournament
snapshot. It records official FIFA sources searched, fixed access timestamps,
response checksums when responses were available, missing fair-play fields, and
the retained unresolved Ecuador/Ghana fair-play tie. Each reviewed source uses a
stable source candidate ID plus structured access and fair-play-evidence result
fields so the verifier can require exact identity and insufficiency semantics.
It must not be converted into zero-deduction fair-play records.
