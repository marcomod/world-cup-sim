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
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">
          Tournament Projection Odds
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {description} Sample size: {simulationCountLabel}.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Team</th>
              <th className="px-4 py-3 font-semibold">Reach Round of 16</th>
              <th className="px-4 py-3 font-semibold">Reach Quarterfinal</th>
              <th className="px-4 py-3 font-semibold">Reach Semifinal</th>
              <th className="px-4 py-3 font-semibold">Reach Final</th>
              <th className="px-4 py-3 font-semibold">Win Tournament</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => (
              <tr key={row.teamId}>
                <td className="px-4 py-3 font-medium text-slate-950">
                  {row.teamName}
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">
                  {row.roundOf16ProbabilityLabel}
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">
                  {row.quarterfinalProbabilityLabel}
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">
                  {row.semifinalProbabilityLabel}
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">
                  {row.finalProbabilityLabel}
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-slate-950">
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
