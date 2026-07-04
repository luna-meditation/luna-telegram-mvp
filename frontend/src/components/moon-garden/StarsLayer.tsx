const starPositions = [
  [10, 14, 1.4, 0.1],
  [18, 24, 0.9, 1.2],
  [28, 12, 1.2, 2.1],
  [39, 21, 0.8, 0.6],
  [52, 10, 1.5, 1.8],
  [63, 18, 0.9, 0.3],
  [72, 9, 1.1, 2.6],
  [84, 23, 1.3, 1.1],
  [91, 14, 0.8, 2.2],
  [14, 36, 0.8, 2.8],
  [47, 34, 0.9, 1.5],
  [79, 38, 0.7, 0.4]
] as const;

export function StarsLayer({ level }: { level: number }) {
  const visibleStars = Math.min(starPositions.length, 5 + level);

  return (
    <div className="moon-garden-stars" aria-hidden="true">
      {starPositions.slice(0, visibleStars).map(([left, top, size, delay]) => (
        <span
          key={`${left}-${top}`}
          className="moon-garden-star"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${size}px`,
            height: `${size}px`,
            animationDelay: `${delay}s`
          }}
        />
      ))}
    </div>
  );
}
