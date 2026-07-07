import { MatchTeamRow } from "@/src/components/Bracket/MatchTeamRow";
import type { MatchCardViewModel } from "@/src/components/viewModels/bracketViewModels";

interface MatchCardProps {
  match: MatchCardViewModel;
}

function getMatchStatusClass(statusLabel: string) {
  if (statusLabel === "Official completed") {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-200";
  }

  if (statusLabel === "Pending official") {
    return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  }

  if (statusLabel === "Simulation projection") {
    return "border-sky-300/30 bg-sky-300/10 text-sky-200";
  }

  if (statusLabel.startsWith("Winner:")) {
    return "border-sky-300/30 bg-sky-300/10 text-sky-200";
  }

  return "border-white/10 bg-white/5 text-[#a8afb9]";
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
          <span
            className={`min-w-0 truncate border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] ${getMatchStatusClass(match.statusLabel)}`}
          >
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
