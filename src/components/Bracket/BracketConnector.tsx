interface BracketConnectorProps {
  direction: "left" | "right";
  groups?: number;
  straight?: boolean;
}

export function BracketConnector({
  direction,
  groups = 1,
  straight = false,
}: BracketConnectorProps) {
  if (straight) {
    return (
      <div className="bracket-connector-column" aria-hidden="true">
        <span className="bracket-connector-straight" />
      </div>
    );
  }

  return (
    <div
      className="bracket-connector-column"
      style={{ gridTemplateRows: `repeat(${groups}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {Array.from({ length: groups }, (_, index) => (
        <span
          key={index}
          className={`bracket-connector-merge bracket-connector-merge--${direction}`}
        />
      ))}
    </div>
  );
}
