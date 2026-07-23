export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-surface px-5 py-5 sm:px-8">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-xl font-bold text-ink sm:text-2xl">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
