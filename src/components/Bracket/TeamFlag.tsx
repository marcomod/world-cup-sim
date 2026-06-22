interface TeamFlagProps {
  flagPath: string;
  className?: string;
}

export function TeamFlag({ flagPath, className = "" }: TeamFlagProps) {
  return (
    <svg
      className={`shrink-0 overflow-hidden rounded-[2px] border border-white/15 bg-[#252a31] ${className}`}
      viewBox="0 0 48 32"
      aria-hidden="true"
      focusable="false"
    >
      <use href={flagPath} />
    </svg>
  );
}
