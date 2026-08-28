export type V2Stat = {
  label: string;
  value: string;
  secondary?: string;
  kind?: 'streak' | 'checkins' | 'mood' | 'energy';
  tone?: 'high' | 'medium' | 'low';
};

export function V2Stats({ stats }: { stats: V2Stat[] }) {
  const summary = stats.slice(0, 3);

  return (
    <section className="home-v2-summary" aria-label="Personal summary">
      <dl>
        {summary.map((stat) => (
          <div key={stat.label} className={stat.kind ? `home-v2-summary-${stat.kind}` : undefined}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}{stat.secondary ? <small>{stat.secondary}</small> : null}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
