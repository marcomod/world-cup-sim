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

Attack and defense ratings are independent normalized 0-100 values, where higher is better.

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
- penalties: normalized 0-100 penalty ability signal for future use.

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

Match Score

Represents the final score of a match in planned scoreline simulation.

The current rating-based simulator does not produce scores, extra time results, or penalty shootout details.

export interface MatchScore {
teamAGoals: number;
teamBGoals: number;
decidedBy:
| "regular_time"
| "extra_time"
| "penalties";
}

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
}

Current match simulation results include only the winner, loser, and matchup probabilities.

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
