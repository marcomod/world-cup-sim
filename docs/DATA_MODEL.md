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
overall: number;
attack: number;
defense: number;
recentForm?: number;
squadStrength?: number;
penalties?: number;
}

Notes

Attack and defense ratings are independent.

Additional rating components may be introduced later.

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

Represents the final score of a match.

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
score: MatchScore;
teamAWinProbability: number;
teamBWinProbability: number;
}

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
