import { TeamFlag } from "@/src/components/Bracket/TeamFlag";
import type { ChampionViewModel } from "@/src/components/viewModels/bracketViewModels";

interface ChampionPanelProps {
  champion: ChampionViewModel;
}

export function ChampionPanel({ champion }: ChampionPanelProps) {
  return (
    <section
      className={`absolute inset-x-0 top-[270px] border px-4 py-4 text-center shadow-[0_18px_50px_rgba(0,0,0,0.28)] ${
        champion.isKnown
          ? "border-amber-400/55 bg-[#211b10]"
          : "border-white/12 bg-[#14171c]"
      }`}
      aria-label="Tournament Champion"
      data-champion-state={champion.isKnown ? "complete" : "placeholder"}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
        Tournament Champion
      </p>
      <div className="mt-3 flex min-h-8 items-center justify-center gap-2.5">
        <TeamFlag
          flagPath={champion.flagPath}
          className="h-6 w-9"
        />
        <p
          className={`text-base font-bold ${
            champion.isKnown ? "text-white" : "text-[#8c929d]"
          }`}
        >
          {champion.teamName}
        </p>
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8c929d]">
        {champion.statusLabel}
      </p>
    </section>
  );
}
