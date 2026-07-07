import { useEffect, useRef } from "react";
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

type MatchChildren = { teamA?: MatchCardViewModel; teamB?: MatchCardViewModel };
type RoundOrder = Partial<Record<TournamentRound, MatchCardViewModel[]>>;

// Invert each match's winner-advancement link (nextMatchId + nextSlot) into a
// parent -> { teamA, teamB } map so the bracket can be laid out from the
// champion-path tree rather than by regrouping each round independently.
function buildChildrenByParent(matches: MatchCardViewModel[]): Map<string, MatchChildren> {
  const childrenByParent = new Map<string, MatchChildren>();

  for (const match of matches) {
    if (!match.nextMatchId || !match.nextSlot) {
      continue;
    }

    const entry = childrenByParent.get(match.nextMatchId) ?? {};

    if (match.nextSlot === "teamAId") {
      entry.teamA = match;
    } else {
      entry.teamB = match;
    }

    childrenByParent.set(match.nextMatchId, entry);
  }

  return childrenByParent;
}

// In-order walk (teamA subtree -> node -> teamB subtree) of one subtree,
// bucketing nodes per round. This yields, for every round, the crossing-free
// vertical order with each parent centered between its two children.
function collectSubtreeByRound(
  root: MatchCardViewModel | undefined,
  childrenByParent: Map<string, MatchChildren>,
): RoundOrder {
  const byRound: RoundOrder = {};

  if (!root) {
    return byRound;
  }

  const walk = (node: MatchCardViewModel) => {
    const children = childrenByParent.get(node.id);

    if (children?.teamA) {
      walk(children.teamA);
    }

    (byRound[node.round] ??= []).push(node);

    if (children?.teamB) {
      walk(children.teamB);
    }
  };

  walk(root);

  return byRound;
}

function getRoundOrder(order: RoundOrder, round: TournamentRound): MatchCardViewModel[] {
  return order[round] ?? [];
}

export function Bracket({ matches, champion }: BracketProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Open the bracket centered on the Final/Champion column instead of the far
  // left; an instant scroll on first mount, so nothing animates.
  useEffect(() => {
    const container = scrollContainerRef.current;

    if (container) {
      container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
    }
  }, []);

  const childrenByParent = buildChildrenByParent(matches);
  const finalMatch = matches.find((match) => match.round === "final");
  const finalChildren = finalMatch ? childrenByParent.get(finalMatch.id) : undefined;

  // Left/right is simply the split at the final's two children: everything in
  // the m101 (teamA) subtree renders left, the m102 (teamB) subtree right.
  const leftOrder = collectSubtreeByRound(finalChildren?.teamA, childrenByParent);
  const rightOrder = collectSubtreeByRound(finalChildren?.teamB, childrenByParent);

  const leftRoundOf32 = getRoundOrder(leftOrder, "round_of_32");
  const leftRoundOf16 = getRoundOrder(leftOrder, "round_of_16");
  const leftQuarterfinals = getRoundOrder(leftOrder, "quarterfinal");
  const leftSemifinals = getRoundOrder(leftOrder, "semifinal");
  const rightRoundOf32 = getRoundOrder(rightOrder, "round_of_32");
  const rightRoundOf16 = getRoundOrder(rightOrder, "round_of_16");
  const rightQuarterfinals = getRoundOrder(rightOrder, "quarterfinal");
  const rightSemifinals = getRoundOrder(rightOrder, "semifinal");

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
        <div className="flex flex-wrap items-center justify-end gap-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8c929d]">
          <span className="flex items-center gap-2">
            <span className="h-3 w-0.5 bg-amber-400" /> Winner
          </span>
          <span>Scroll horizontally to inspect every round</span>
        </div>
      </div>

      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#0b0d10] to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0b0d10] to-transparent"
        />
        <div
          ref={scrollContainerRef}
          className="bracket-horizontal-scroll mt-5 overflow-x-auto pb-5"
          role="region"
          aria-label="Scrollable knockout bracket"
          tabIndex={0}
        >
          <div className="knockout-bracket-grid mx-auto px-4" data-bracket-match-count={matches.length}>
            <BracketRound label={roundLabels.round_of_32} matches={leftRoundOf32} round="round_of_32" side="left" />
            <BracketConnector direction="left" groups={leftRoundOf16.length} />
            <BracketRound label={roundLabels.round_of_16} matches={leftRoundOf16} round="round_of_16" side="left" />
            <BracketConnector direction="left" groups={leftQuarterfinals.length} />
            <BracketRound label={roundLabels.quarterfinal} matches={leftQuarterfinals} round="quarterfinal" side="left" />
            <BracketConnector direction="left" groups={leftSemifinals.length} />
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
            <BracketConnector direction="right" groups={rightSemifinals.length} />
            <BracketRound label={roundLabels.quarterfinal} matches={rightQuarterfinals} round="quarterfinal" side="right" />
            <BracketConnector direction="right" groups={rightQuarterfinals.length} />
            <BracketRound label={roundLabels.round_of_16} matches={rightRoundOf16} round="round_of_16" side="right" />
            <BracketConnector direction="right" groups={rightRoundOf16.length} />
            <BracketRound label={roundLabels.round_of_32} matches={rightRoundOf32} round="round_of_32" side="right" />
          </div>
        </div>
      </div>
    </section>
  );
}
