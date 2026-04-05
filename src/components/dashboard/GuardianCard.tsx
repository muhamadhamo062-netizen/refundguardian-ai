interface GuardianCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'active' | 'inactive' | 'pending';
  stats?: { label: string; value: string }[];
}

export function GuardianCard({
  title,
  description,
  icon,
  status,
  stats = [],
}: GuardianCardProps) {
  const statusColors = {
    active: 'border-[var(--accent)]/50 bg-[var(--accent)]/5',
    inactive: 'border-[var(--border)] bg-[var(--card)]',
    pending: 'border-amber-500/50 bg-amber-500/5',
  };

  return (
    <div
      className={`rounded-2xl border p-6 transition-colors hover:bg-[var(--card-hover)] ${statusColors[status]}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--card)] text-[var(--accent)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
          {stats.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-4">
              {stats.map(({ label, value }) => (
                <div key={label}>
                  <span className="text-xs text-[var(--muted)]">{label}</span>
                  <p className="font-medium text-white">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
