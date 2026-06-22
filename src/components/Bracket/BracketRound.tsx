import { MatchCard } from "@/src/components/Bracket/MatchCard";
import type { MatchCardViewModel } from "@/src/components/viewModels/bracketViewModels";
import type { TournamentRound } from "@/src/lib/simulator/types";

interface BracketRoundProps {
  label: string;
  matches: MatchCardViewModel[];
  round: TournamentRound;
  side: "left" | "right";
}

export function BracketRound({ label, matches, round, side }: BracketRoundProps) {
  const headingId = `${side}-${round}-heading`;

  return (
    <section
      className="bracket-round-column"
      aria-labelledby={headingId}
      data-round-column={round}
      data-side={side}
    >
      <h3
        id={headingId}
        className={`h-10 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9da4af] ${
          side === "right" ? "text-right" : "text-left"
        }`}
      >
        {label}
      </h3>
      <div
        className="grid h-[1080px]"
        style={{ gridTemplateRows: `repeat(${matches.length}, minmax(0, 1fr))` }}
      >
        {matches.map((match) => (
          <div key={match.id} className="flex items-center">
            <MatchCard match={match} />
          </div>
        ))}
      </div>
    </section>
  );
}
