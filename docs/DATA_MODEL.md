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
- `ThirdPlaceAssignment`, the static Annex C mapping from a canonical
  eight-group key to the eight third-place Round-of-32 slots.
- `KnockoutTopologyMatch`, the canonical progression from `m73` through the
  final `m104`, including explicit winner and loser advancement. Semifinal
  losers advance to the third-place match `m103`; semifinal winners advance to
  the final `m104`. The current simulator adapter consumes only champion-path
  winner links.

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
