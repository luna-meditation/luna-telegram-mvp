import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, trailing, as = 'h1' }: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  as?: 'h1' | 'h2';
}) {
  const Heading = as;
  return (
    <header className="page-header" data-testid="page-header">
      <div className="page-header-copy">
        <Heading className="type-page-title">{title}</Heading>
        {subtitle ? <p className="type-body-small">{subtitle}</p> : null}
      </div>
      {trailing}
    </header>
  );
}
