export function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <header className="ad-page-head">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

export function Card({
  title,
  subtitle,
  action,
  className = "",
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`ad-card ${className}`}>
      {(title || action) && (
        <header className="ad-card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageSkeleton() {
  return (
    <div className="ad-skeleton" aria-busy="true" aria-label="Loading">
      <div className="ad-skel-row">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="ad-skel ad-skel-kpi" />
        ))}
      </div>
      <span className="ad-skel ad-skel-block" />
    </div>
  );
}
