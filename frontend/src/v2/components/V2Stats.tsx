export type V2Stat = {
  label: string;
  value: string;
  secondary?: string;
};

export function V2Stats({ stats }: { stats: V2Stat[] }) {
  return (
    <section className="home-v2-stats" aria-label="Home stats">
      {stats.slice(0, 4).map((stat) => (
        <article key={stat.label} className="home-v2-stat-card">
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          {stat.secondary ? <small>{stat.secondary}</small> : null}
        </article>
      ))}
    </section>
  );
}
