export type V2Stat = {
  label: string;
  value: string;
  secondary?: string;
  kind?: 'streak' | 'checkins' | 'mood' | 'energy';
};

export function V2Stats({ stats }: { stats: V2Stat[] }) {
  return (
    <section className="home-v2-stats" aria-label="Home stats">
      {stats.slice(0, 4).map((stat) => (
        <article key={stat.label} className={`home-v2-stat-card ${stat.kind ? `home-v2-stat-${stat.kind}` : ''}`}>
          <i aria-hidden="true" />
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          {stat.secondary ? <small>{stat.secondary}</small> : null}
        </article>
      ))}
    </section>
  );
}
