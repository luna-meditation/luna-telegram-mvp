type V2HeaderProps = {
  greeting: string;
  firstName: string;
  quietLabel: string;
};

export function V2Header({ greeting, firstName, quietLabel }: V2HeaderProps) {
  return (
    <header className="home-v2-topbar">
      <div className="home-v2-top-id">
        <span className="home-v2-mini-mark" aria-hidden="true" />
        <div>
          <p className="home-v2-top-greeting">{greeting}, {firstName}</p>
          <p className="home-v2-top-brand">LUNA</p>
        </div>
      </div>
      <span className="home-v2-top-pill">{quietLabel}</span>
    </header>
  );
}
