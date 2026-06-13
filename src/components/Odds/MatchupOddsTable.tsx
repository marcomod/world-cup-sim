import type { MatchupOddsRowViewModel } from "@/src/components/viewModels/bracketViewModels";

interface MatchupOddsTableProps {
  rows: MatchupOddsRowViewModel[];
  hasSimulated: boolean;
}

export function MatchupOddsTable({ rows, hasSimulated }: MatchupOddsTableProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">Current Matchup Odds</h2>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Match</th>
                <th className="px-4 py-3 font-semibold">Team A</th>
                <th className="px-4 py-3 font-semibold">Team A Win probability</th>
                <th className="px-4 py-3 font-semibold">Team B</th>
                <th className="px-4 py-3 font-semibold">Team B Win probability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={row.matchId}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {row.matchId}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {row.teamAName}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">
                    {row.teamAWinProbabilityLabel}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {row.teamBName}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">
                    {row.teamBWinProbabilityLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-slate-600">
          {hasSimulated
            ? "All matchups have been simulated."
            : "No ready matchups are available."}
        </p>
      )}
    </section>
  );
}
