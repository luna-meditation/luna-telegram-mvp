export type SegmentedTab<T extends string> = { id: T; label: string };

export function SegmentedTabs<T extends string>({ tabs, value, onChange, ariaLabel, className = '' }: {
  tabs: Array<SegmentedTab<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={`segmented-tabs ${className}`} role="tablist" aria-label={ariaLabel} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((tab) => (
        <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
