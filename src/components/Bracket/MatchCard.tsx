import type { MatchCardViewModel } from "@/src/components/viewModels/bracketViewModels";

interface MatchCardProps {
  match: MatchCardViewModel;
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium text-slate-500">{match.id}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
          {match.statusLabel}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
          <span className={match.teamAIsKnown ? "font-medium text-slate-950" : "text-slate-400"}>
            {match.teamAName}
          </span>
          <span className="font-mono text-xs text-slate-500">
            {match.teamAWinProbabilityLabel ?? "--"}
          </span>
        </div>

        <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
          <span className={match.teamBIsKnown ? "font-medium text-slate-950" : "text-slate-400"}>
            {match.teamBName}
          </span>
          <span className="font-mono text-xs text-slate-500">
            {match.teamBWinProbabilityLabel ?? "--"}
          </span>
        </div>
      </div>
    </article>
  );
}
