const motePositions = [
  [20, 70, 0.1],
  [32, 62, 1.8],
  [46, 74, 3.1],
  [61, 66, 1.1],
  [74, 58, 2.4],
  [83, 72, 3.8],
  [54, 52, 4.5],
  [25, 48, 5.2],
  [68, 44, 0.7],
  [88, 50, 2.9]
] as const;

export function FirefliesLayer({ level }: { level: number }) {
  if (level < 3) return null;

  const visibleMotes = Math.min(motePositions.length, level + 1);

  return (
    <div className="moon-garden-fireflies" aria-hidden="true">
      {motePositions.slice(0, visibleMotes).map(([left, top, delay]) => (
        <span
          key={`${left}-${top}`}
          className="moon-garden-mote"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            animationDelay: `${delay}s`
          }}
        />
      ))}
    </div>
  );
}
