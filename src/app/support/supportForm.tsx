'use client';

import { useMemo, useState, type FormEvent } from 'react';

type SupportPayload = {
  name: string;
  email: string;
  message: string;
  whatsapp?: string;
  /** Honeypot (should stay empty) */
  company?: string;
};

export function SupportForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState(''); // honeypot

  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!name.trim()) return false;
    if (!email.trim()) return false;
    if (!message.trim()) return false;
    return true;
  }, [loading, name, email, message]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setOk(null);
    setErr(null);
    try {
      const payload: SupportPayload = {
        name: name.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim() || undefined,
        message: message.trim(),
        company: company.trim() || undefined,
      };

      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok !== true) {
        setErr(body.error || 'Could not send your message.');
        return;
      }
      setName('');
      setEmail('');
      setWhatsapp('');
      setMessage('');
      setCompany('');
      setOk('تم استلام رسالتك وسيتم الرد خلال 24 إلى 48 ساعة.');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-lg shadow-black/20 sm:p-6">
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rg-support-name" className="mb-1 block text-xs font-medium text-zinc-400">
              Name
            </label>
            <input
              id="rg-support-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-white"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="rg-support-email" className="mb-1 block text-xs font-medium text-zinc-400">
              Email
            </label>
            <input
              id="rg-support-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-white"
              placeholder="you@email.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="rg-support-whatsapp" className="mb-1 block text-xs font-medium text-zinc-400">
            WhatsApp (optional)
          </label>
          <input
            id="rg-support-whatsapp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-white"
            placeholder="+1 555 123 4567"
          />
        </div>

        {/* Honeypot field (hidden) */}
        <div className="hidden" aria-hidden>
          <label htmlFor="rg-support-company">Company</label>
          <input
            id="rg-support-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="off"
            tabIndex={-1}
          />
        </div>

        <div>
          <label htmlFor="rg-support-message" className="mb-1 block text-xs font-medium text-zinc-400">
            What’s the issue?
          </label>
          <textarea
            id="rg-support-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={6}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-white"
            placeholder="Describe the problem and any steps to reproduce…"
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full min-h-[48px] touch-manipulation rounded-xl bg-[var(--accent)] px-4 py-3 text-base font-semibold text-[var(--background)] disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send message'}
        </button>

        {ok ? (
          <p className="text-sm font-medium text-emerald-200" role="status">
            {ok}
          </p>
        ) : null}
        {err ? (
          <p className="text-sm font-medium text-rose-200" role="alert">
            {err}
          </p>
        ) : null}
      </form>
    </div>
  );
}

