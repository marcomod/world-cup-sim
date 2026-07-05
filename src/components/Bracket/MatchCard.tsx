import { MatchTeamRow } from "@/src/components/Bracket/MatchTeamRow";
import type { MatchCardViewModel } from "@/src/components/viewModels/bracketViewModels";

interface MatchCardProps {
  match: MatchCardViewModel;
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <article
      className="h-32 w-full border border-white/12 bg-[#171a1f] shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
      data-match-id={match.id}
      data-round={match.round}
      aria-label={match.accessibleLabel}
    >
      <div aria-hidden="true">
        <div className="flex h-7 items-center justify-between gap-2 border-b border-white/8 px-2.5">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#747c88]">
            {match.id}
          </span>
          <span className="min-w-0 truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-[#a8afb9]">
            {match.decisionLabel
              ? `${match.statusLabel} · ${match.decisionLabel}`
              : match.statusLabel}
          </span>
        </div>

        <div className="divide-y divide-white/8">
          <MatchTeamRow
            name={match.teamAName}
            flagPath={match.teamAFlagPath}
            isKnown={match.teamAIsKnown}
            isWinner={match.teamAIsWinner}
            probabilityLabel={match.teamAWinProbabilityLabel}
            scoreLabel={match.teamAScoreLabel}
          />
          <MatchTeamRow
            name={match.teamBName}
            flagPath={match.teamBFlagPath}
            isKnown={match.teamBIsKnown}
            isWinner={match.teamBIsWinner}
            probabilityLabel={match.teamBWinProbabilityLabel}
            scoreLabel={match.teamBScoreLabel}
          />
        </div>

        <p
          className={`flex h-6 items-center border-t border-white/8 px-2.5 font-mono text-[9px] ${
            match.scorelineLabel?.includes("pens")
              ? "text-amber-200"
              : "text-[#8c929d]"
          }`}
        >
          {match.scorelineLabel ?? "\u00a0"}
        </p>
      </div>
    </article>
  );
}
