import { MatchCard } from "@/src/components/Bracket/MatchCard";
import type { MatchCardViewModel } from "@/src/components/viewModels/bracketViewModels";
import type { TournamentRound } from "@/src/lib/simulator/types";

const roundOrder: TournamentRound[] = [
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "final",
];

const roundLabels: Record<TournamentRound, string> = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "Final",
};

interface BracketProps {
  matches: MatchCardViewModel[];
}

export function Bracket({ matches }: BracketProps) {
  return (
    <section className="overflow-x-auto pb-2">
      <div className="grid min-w-[1120px] grid-cols-5 gap-4">
        {roundOrder.map((round) => {
          const roundMatches = matches.filter((match) => match.round === round);

          return (
            <div key={round} className="flex flex-col gap-3">
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 py-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                  {roundLabels[round]}
                </h2>
              </div>
              <div className="flex flex-col gap-3">
                {roundMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
