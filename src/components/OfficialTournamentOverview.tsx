import { officialTournamentUiData } from "@/src/data/world-cup-2026/officialArtifacts";

export function OfficialTournamentOverview() {
  return (
    <section
      className="mx-auto w-full max-w-[1800px] px-4 pb-8 sm:px-6"
      aria-labelledby="official-tournament-heading"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <div className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">
                Official tournament bracket/data
              </p>
              <h2 id="official-tournament-heading" className="mt-2 text-2xl font-bold text-white">
                Finalized Round of 32
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#d7dce3]">
              <span className="border border-sky-300/30 bg-sky-300/10 px-2.5 py-1">
                {officialTournamentUiData.thirdPlaceGroupKeyLabel}
              </span>
              <span className="border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1">
                Post-group-stage model ratings
              </span>
            </div>
          </div>

          <p className="mt-4 max-w-4xl text-sm leading-6 text-[#b6bec9]">
            {officialTournamentUiData.ecuadorGhanaNote}
          </p>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[#b6bec9]">
            {officialTournamentUiData.fairPlayStatusLabel}
          </p>

          <div className="mt-5 overflow-x-auto border border-white/10">
            <table
              className="min-w-[920px] w-full border-collapse text-left text-sm"
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

        <aside
          className="border border-white/10 bg-[#12161c] p-4"
          aria-labelledby="official-details-heading"
        >
          <h3 id="official-details-heading" className="text-sm font-bold text-white">
            Source/artifact status
          </h3>
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

          <details className="mt-5 border-t border-white/10 pt-4">
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

          <div className="mt-6 border-t border-white/10 pt-4">
            <h3 className="text-sm font-bold text-white">
              Post-group-stage model ratings
            </h3>
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
          </div>
        </aside>
      </div>
    </section>
  );
}
