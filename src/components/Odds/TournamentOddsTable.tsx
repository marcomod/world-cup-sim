import type { TournamentOddsRowViewModel } from "@/src/components/viewModels/tournamentOddsViewModels";

interface TournamentOddsTableProps {
  rows: TournamentOddsRowViewModel[];
  simulationCountLabel: string;
  description: string;
}

export function TournamentOddsTable({
  rows,
  simulationCountLabel,
  description,
}: TournamentOddsTableProps) {
  return (
    <section className="border border-white/10 bg-[#12161c]">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-white">
          Tournament Projection Odds
        </h2>
        <p className="mt-1 text-sm text-[#8c929d]">
          {description} Sample size: {simulationCountLabel}.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-white/6 text-xs uppercase tracking-wide text-[#8c929d]">
            <tr>
              <th className="px-4 py-3 font-semibold">Team</th>
              <th className="px-4 py-3 font-semibold">Reach Round of 16</th>
              <th className="px-4 py-3 font-semibold">Reach Quarterfinal</th>
              <th className="px-4 py-3 font-semibold">Reach Semifinal</th>
              <th className="px-4 py-3 font-semibold">Reach Final</th>
              <th className="px-4 py-3 font-semibold">Win Tournament</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {rows.map((row) => (
              <tr key={row.teamId}>
                <td className="px-4 py-3 font-medium text-[#edf0f4]">
                  {row.teamName}
                </td>
                <td className="px-4 py-3 font-mono text-[#b6bec9]">
                  {row.roundOf16ProbabilityLabel}
                </td>
                <td className="px-4 py-3 font-mono text-[#b6bec9]">
                  {row.quarterfinalProbabilityLabel}
                </td>
                <td className="px-4 py-3 font-mono text-[#b6bec9]">
                  {row.semifinalProbabilityLabel}
                </td>
                <td className="px-4 py-3 font-mono text-[#b6bec9]">
                  {row.finalProbabilityLabel}
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-white">
                  {row.championProbabilityLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
