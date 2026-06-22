import { TeamFlag } from "@/src/components/Bracket/TeamFlag";

interface MatchTeamRowProps {
  name: string;
  flagPath: string;
  isKnown: boolean;
  isWinner: boolean;
  probabilityLabel: string | null;
  scoreLabel: string | null;
}

export function MatchTeamRow({
  name,
  flagPath,
  isKnown,
  isWinner,
  probabilityLabel,
  scoreLabel,
}: MatchTeamRowProps) {
  return (
    <div
      className={`flex h-[38px] items-center gap-1.5 border-l-2 px-2 ${
        isWinner
          ? "border-l-amber-400 bg-amber-300/8"
          : "border-l-transparent bg-transparent"
      }`}
      data-winner={isWinner ? "true" : undefined}
    >
      <TeamFlag flagPath={flagPath} className="h-4 w-6" />
      <span
        className={`min-w-0 flex-1 truncate text-[11px] ${
          isKnown ? "text-[#edf0f4]" : "italic text-[#747c88]"
        } ${isWinner ? "font-bold" : "font-medium"}`}
      >
        {name}
      </span>
      {isWinner ? (
        <span
          className="text-[8px] font-bold uppercase tracking-[0.05em] text-amber-300"
          aria-label="Winner"
        >
          Win
        </span>
      ) : null}
      <span className="w-7 text-right font-mono text-[10px] text-[#9da4af]">
        {probabilityLabel ?? "--"}
      </span>
      <span className="w-4 text-right font-mono text-sm font-bold text-white">
        {scoreLabel ?? ""}
      </span>
    </div>
  );
}
