'use client';

import { useState } from 'react';

export function ScanButton() {
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleScan}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--background)] hover:bg-[var(--accent-muted)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? 'Scanning…' : 'Scan Last 30 Days'}
    </button>
  );
}
