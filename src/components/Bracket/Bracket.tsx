import { BracketConnector } from "@/src/components/Bracket/BracketConnector";
import { BracketRound } from "@/src/components/Bracket/BracketRound";
import { ChampionPanel } from "@/src/components/Bracket/ChampionPanel";
import { MatchCard } from "@/src/components/Bracket/MatchCard";
import type {
  ChampionViewModel,
  MatchCardViewModel,
} from "@/src/components/viewModels/bracketViewModels";
import type { TournamentRound } from "@/src/lib/simulator/types";

const roundLabels: Record<TournamentRound, string> = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "Final",
};

interface BracketProps {
  matches: MatchCardViewModel[];
  champion: ChampionViewModel;
}

function getRoundMatches(
  matches: MatchCardViewModel[],
  round: TournamentRound,
): MatchCardViewModel[] {
  return matches.filter((match) => match.round === round);
}

function splitRound(matches: MatchCardViewModel[]): [MatchCardViewModel[], MatchCardViewModel[]] {
  const midpoint = Math.ceil(matches.length / 2);

  return [matches.slice(0, midpoint), matches.slice(midpoint)];
}

export function Bracket({ matches, champion }: BracketProps) {
  const [leftRoundOf32, rightRoundOf32] = splitRound(
    getRoundMatches(matches, "round_of_32"),
  );
  const [leftRoundOf16, rightRoundOf16] = splitRound(
    getRoundMatches(matches, "round_of_16"),
  );
  const [leftQuarterfinals, rightQuarterfinals] = splitRound(
    getRoundMatches(matches, "quarterfinal"),
  );
  const [leftSemifinals, rightSemifinals] = splitRound(
    getRoundMatches(matches, "semifinal"),
  );
  const finalMatch = getRoundMatches(matches, "final")[0];

  return (
    <section className="border-y border-white/10 bg-[#0b0d10] py-6" aria-labelledby="bracket-heading">
      <div className="mx-auto flex max-w-[1800px] items-end justify-between gap-6 px-4 sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
            Knockout bracket
          </p>
          <h2 id="bracket-heading" className="mt-1 text-xl font-bold text-white">
            Road to the trophy
          </h2>
        </div>
        <div className="hidden items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8c929d] sm:flex">
          <span className="flex items-center gap-2">
            <span className="h-3 w-0.5 bg-amber-400" /> Winner
          </span>
          <span>Scroll horizontally to inspect every round</span>
        </div>
      </div>

      <div
        className="bracket-horizontal-scroll mt-5 overflow-x-auto pb-5"
        role="region"
        aria-label="Scrollable knockout bracket"
        tabIndex={0}
      >
        <div className="knockout-bracket-grid mx-auto px-4" data-bracket-match-count={matches.length}>
          <BracketRound label={roundLabels.round_of_32} matches={leftRoundOf32} round="round_of_32" side="left" />
          <BracketConnector direction="left" groups={4} />
          <BracketRound label={roundLabels.round_of_16} matches={leftRoundOf16} round="round_of_16" side="left" />
          <BracketConnector direction="left" groups={2} />
          <BracketRound label={roundLabels.quarterfinal} matches={leftQuarterfinals} round="quarterfinal" side="left" />
          <BracketConnector direction="left" />
          <BracketRound label={roundLabels.semifinal} matches={leftSemifinals} round="semifinal" side="left" />
          <BracketConnector direction="left" straight />

          <section className="bracket-final-column" aria-labelledby="final-heading" data-round-column="final">
            <h3 id="final-heading" className="h-10 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
              {roundLabels.final}
            </h3>
            <div className="relative h-[1080px]">
              <ChampionPanel champion={champion} />
              {finalMatch ? (
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                  <MatchCard match={finalMatch} />
                </div>
              ) : null}
            </div>
          </section>

          <BracketConnector direction="right" straight />
          <BracketRound label={roundLabels.semifinal} matches={rightSemifinals} round="semifinal" side="right" />
          <BracketConnector direction="right" />
          <BracketRound label={roundLabels.quarterfinal} matches={rightQuarterfinals} round="quarterfinal" side="right" />
          <BracketConnector direction="right" groups={2} />
          <BracketRound label={roundLabels.round_of_16} matches={rightRoundOf16} round="round_of_16" side="right" />
          <BracketConnector direction="right" groups={4} />
          <BracketRound label={roundLabels.round_of_32} matches={rightRoundOf32} round="round_of_32" side="right" />
        </div>
      </div>
    </section>
  );
}
