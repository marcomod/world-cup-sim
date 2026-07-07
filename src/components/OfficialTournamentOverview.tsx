import { officialTournamentUiData } from "@/src/data/world-cup-2026/officialArtifacts";

function getOfficialStatusClass(statusTone: "completed" | "pending") {
  if (statusTone === "completed") {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-200";
  }

  return "border-amber-300/30 bg-amber-300/10 text-amber-200";
}

export function OfficialTournamentOverview() {
  return (
    <section
      className="mx-auto mt-10 w-full max-w-[1800px] border-t border-white/10 px-4 pb-8 pt-8 sm:px-6"
      aria-labelledby="official-tournament-heading"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <div className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-300">
                Official tournament bracket/data
              </p>
              <h2 id="official-tournament-heading" className="mt-2 text-2xl font-bold text-white">
                Official bracket and result status
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#b6bec9]">
                The Round of 32 field is fixed. Completed official results are
                shown beside pending fixtures that still need simulation.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs sm:min-w-[330px]">
              <div className="border border-emerald-300/25 bg-emerald-300/8 px-3 py-2">
                <p className="text-lg font-bold text-emerald-200">
                  {officialTournamentUiData.knockoutStatusSummary.completedCount}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8c929d]">
                  Completed
                </p>
              </div>
              <div className="border border-amber-300/25 bg-amber-300/8 px-3 py-2">
                <p className="text-lg font-bold text-amber-200">
                  {officialTournamentUiData.knockoutStatusSummary.pendingCount}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8c929d]">
                  Pending
                </p>
              </div>
              <div className="border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-lg font-bold text-white">
                  {officialTournamentUiData.knockoutStatusSummary.totalCount}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8c929d]">
                  Tracked
                </p>
              </div>
            </div>
          </div>

          <details className="mt-4 border border-white/10 bg-white/[0.03] px-3 py-2">
            <summary className="cursor-pointer text-xs font-bold text-sky-200">
              Qualification notes and fair-play handling
            </summary>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[#b6bec9]">
              <p>{officialTournamentUiData.ecuadorGhanaNote}</p>
              <p>{officialTournamentUiData.fairPlayStatusLabel}</p>
              <p className="font-mono text-xs text-[#8c929d]">
                {officialTournamentUiData.thirdPlaceGroupKeyLabel}
              </p>
            </div>
          </details>

          <div className="mt-5 border border-white/10 bg-[#12161c]">
            <div className="border-b border-white/10 px-3 py-3">
              <h3 className="text-sm font-bold text-white">
                Finalized Round of 32
              </h3>
              <p className="mt-1 text-xs text-[#8c929d]">
                Official pairings with post-group-stage model ratings.
              </p>
            </div>
            <div className="overflow-x-auto">
            <table
              className="w-full min-w-[780px] border-collapse text-left text-sm"
              aria-label="Finalized official Round of 32"
            >
              <thead className="bg-white/6 text-[10px] uppercase tracking-[0.12em] text-[#8c929d]">
                <tr>
                  <th className="px-3 py-2 font-bold">Match</th>
                  <th className="px-3 py-2 font-bold">Slot</th>
                  <th className="px-3 py-2 font-bold">Team</th>
                  <th className="px-3 py-2 font-bold">Rating</th>
                  <th className="px-3 py-2 font-bold">Slot</th>
                  <th className="px-3 py-2 font-bold">Team</th>
                  <th className="px-3 py-2 font-bold">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {officialTournamentUiData.roundOf32Matches.map((match) => (
                  <tr
                    key={match.id}
                    data-official-match-id={match.id}
                    className="bg-[#12161c] text-[#edf0f4]"
                  >
                    <td className="px-3 py-2 font-mono text-xs font-bold text-sky-200">
                      {match.id}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#8c929d]">
                      {match.teamASlot}
                    </td>
                    <td className="px-3 py-2 font-semibold">{match.teamAName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-emerald-200">
                      {match.teamARatingLabel}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#8c929d]">
                      {match.teamBSlot}
                    </td>
                    <td className="px-3 py-2 font-semibold">{match.teamBName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-emerald-200">
                      {match.teamBRatingLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className="mt-5 border border-white/10 bg-[#12161c]">
            <div className="flex flex-col gap-3 border-b border-white/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Official knockout result status
                </h3>
                <p className="mt-1 text-xs text-[#8c929d]">
                  Completed and pending official fixtures for the simulation sandbox above.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.1em]">
                <span className="border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-emerald-200">
                  Official completed
                </span>
                <span className="border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-amber-200">
                  Pending official
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table
              className="w-full min-w-[820px] border-collapse text-left text-sm"
              aria-label="Official knockout result status"
            >
              <thead className="bg-white/6 text-[10px] uppercase tracking-[0.12em] text-[#8c929d]">
                <tr>
                  <th className="px-3 py-2 font-bold">Match</th>
                  <th className="px-3 py-2 font-bold">Round</th>
                  <th className="px-3 py-2 font-bold">Team A</th>
                  <th className="px-3 py-2 font-bold">Team B</th>
                  <th className="px-3 py-2 font-bold">Official status</th>
                  <th className="px-3 py-2 font-bold">Official score</th>
                  <th className="px-3 py-2 font-bold">Official winner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {officialTournamentUiData.knockoutStatusMatches.map((match) => (
                  <tr
                    key={match.id}
                    data-official-knockout-match-id={match.id}
                    data-official-knockout-status={match.statusTone}
                    className="bg-[#12161c] text-[#edf0f4]"
                  >
                    <td className="px-3 py-2 font-mono text-xs font-bold text-sky-200">
                      {match.id}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#b6bec9]">
                      {match.roundLabel}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {match.participantALabel}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {match.participantBLabel}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex whitespace-nowrap border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${getOfficialStatusClass(match.statusTone)}`}
                      >
                        {match.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#b6bec9]">
                      {match.scoreLabel}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#d7dce3]">
                      {match.winnerLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        <aside
          className="border border-white/10 bg-[#12161c] p-4"
          aria-labelledby="official-details-heading"
        >
          <h3 id="official-details-heading" className="text-sm font-bold text-white">
            Sources and model inputs
          </h3>
          <p className="mt-2 text-xs leading-5 text-[#8c929d]">
            Main controls stay focused on bracket state. Provenance, checksums,
            and rating inputs remain available here.
          </p>

          <details className="mt-4 border-t border-white/10 pt-4">
            <summary className="cursor-pointer text-xs font-bold text-sky-200">
              Source summary
            </summary>
            <dl className="mt-4 space-y-3">
              {officialTournamentUiData.detailRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8c929d]">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-xs leading-5 text-[#d7dce3]">{row.value}</dd>
                </div>
              ))}
            </dl>
          </details>

          <details className="mt-4 border-t border-white/10 pt-4">
            <summary className="cursor-pointer text-xs font-bold text-sky-200">
              Exact artifact checksums
            </summary>
            <dl className="mt-4 space-y-4">
              {officialTournamentUiData.artifactTraceabilityRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8c929d]">
                    {row.label}
                  </dt>
                  <dd className="mt-1 space-y-1 text-xs leading-5 text-[#d7dce3]">
                    {row.id ? (
                      <p>
                        <span className="text-[#8c929d]">ID: </span>
                        <span className="font-mono break-all">{row.id}</span>
                      </p>
                    ) : null}
                    {row.artifactVersion ? (
                      <p>
                        <span className="text-[#8c929d]">Version: </span>
                        <span className="font-mono break-all">
                          {row.artifactVersion}
                        </span>
                      </p>
                    ) : null}
                    {row.artifactPath ? (
                      <p>
                        <span className="text-[#8c929d]">Path: </span>
                        <span className="font-mono break-all">
                          {row.artifactPath}
                        </span>
                      </p>
                    ) : null}
                    {row.checksum ? (
                      <p>
                        <span className="text-[#8c929d]">
                          {row.checksumLabel ?? "Checksum"}:{" "}
                        </span>
                        <span className="font-mono break-all">{row.checksum}</span>
                      </p>
                    ) : null}
                    {row.value ? (
                      <p>
                        <span className="font-mono break-all">{row.value}</span>
                      </p>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </details>

          <details className="mt-4 border-t border-white/10 pt-4" open>
            <summary className="cursor-pointer text-xs font-bold text-sky-200">
              Post-group-stage model ratings
            </summary>
            <div className="mt-3 max-h-[520px] overflow-auto pr-1">
              <table className="w-full text-left text-xs" aria-label="Official qualified team ratings">
                <thead className="sticky top-0 bg-[#12161c] text-[9px] uppercase tracking-[0.1em] text-[#8c929d]">
                  <tr>
                    <th className="py-2 pr-2 font-bold">Team</th>
                    <th className="py-2 pr-2 text-right font-bold">Overall</th>
                    <th className="py-2 pr-2 text-right font-bold">Atk</th>
                    <th className="py-2 text-right font-bold">Def</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {officialTournamentUiData.ratingRows.map((rating) => (
                    <tr key={rating.teamId}>
                      <td className="py-2 pr-2 font-semibold text-[#edf0f4]">
                        {rating.teamName}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-emerald-200">
                        {rating.overallLabel}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-[#b6bec9]">
                        {rating.attack}
                      </td>
                      <td className="py-2 text-right font-mono text-[#b6bec9]">
                        {rating.defense}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </aside>
      </div>
    </section>
  );
}
