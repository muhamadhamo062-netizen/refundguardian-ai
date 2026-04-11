export interface ActivityItem {
  id: string;
  type: 'scan' | 'claim' | 'refund' | 'alert' | 'check';
  title: string;
  description?: string;
  time: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

const typeStyles: Record<ActivityItem['type'], string> = {
  scan: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  claim: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  refund: 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30',
  alert: 'bg-red-500/15 text-red-400 border-red-500/30',
  check: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const typeIcons: Record<ActivityItem['type'], string> = {
  scan: '○',
  claim: '◇',
  refund: '✓',
  alert: '!',
  check: '✓',
};

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-gradient-to-b from-[var(--card)] to-[#0d0e12] shadow-lg shadow-black/20">
      <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <h3 className="text-sm font-semibold text-white">Recent activity</h3>
        <p className="mt-0.5 text-xs text-[var(--muted)]">A simple timeline of what Refyndra noticed for you</p>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[var(--muted)] sm:px-6">
          No activity yet. Connect Refyndra and your stores — updates will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]/50">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3.5 sm:px-6 ${index === 0 ? 'bg-white/[0.02]' : ''}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-medium ${typeStyles[item.type]}`}
              >
                {typeIcons[item.type]}
              </span>
              <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
                <p className="break-words font-medium text-white">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 break-words text-sm text-[var(--muted)]">{item.description}</p>
                )}
              </div>
              <span className="w-full shrink-0 pl-11 text-xs text-[var(--muted)] sm:w-auto sm:pl-0 sm:ml-auto">
                {item.time}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
