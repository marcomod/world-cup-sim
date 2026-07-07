import type { MatchupOddsRowViewModel } from "@/src/components/viewModels/bracketViewModels";

interface MatchupOddsTableProps {
  rows: MatchupOddsRowViewModel[];
  hasSimulated: boolean;
}

export function MatchupOddsTable({
  rows,
  hasSimulated,
}: MatchupOddsTableProps) {
  return (
    <section className="border border-white/10 bg-[#12161c]">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-white">
          Ready Matchup Odds
        </h2>
        <p className="mt-1 text-sm text-[#8c929d]">
          Probabilities for fixtures with both teams currently known.
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-white/6 text-xs uppercase tracking-wide text-[#8c929d]">
              <tr>
                <th className="px-4 py-3 font-semibold">Match</th>
                <th className="px-4 py-3 font-semibold">Team A</th>
                <th className="px-4 py-3 font-semibold">
                  Team A Win probability
                </th>
                <th className="px-4 py-3 font-semibold">Team B</th>
                <th className="px-4 py-3 font-semibold">
                  Team B Win probability
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {rows.map((row) => (
                <tr key={row.matchId}>
                  <td className="px-4 py-3 font-mono text-xs text-[#8c929d]">
                    {row.matchId}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#edf0f4]">
                    {row.teamAName}
                  </td>
                  <td className="px-4 py-3 font-mono text-[#b6bec9]">
                    {row.teamAWinProbabilityLabel}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#edf0f4]">
                    {row.teamBName}
                  </td>
                  <td className="px-4 py-3 font-mono text-[#b6bec9]">
                    {row.teamBWinProbabilityLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-[#8c929d]">
          {hasSimulated
            ? "All currently visible matchups have been simulated."
            : "No ready matchups are available."}
        </p>
      )}
    </section>
  );
}
