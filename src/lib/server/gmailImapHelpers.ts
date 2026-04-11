import { ImapFlow } from 'imapflow';

const GMAIL_IMAP_HOST = 'imap.gmail.com';

/** Shared timeouts — mobile networks and cold TLS can be slow. */
const CONNECTION_MS = 120_000;
const GREETING_MS = 25_000;
const SOCKET_IDLE_MS = 180_000;

export function createGmailImapClient(email: string, pass: string, opts?: { verifyOnly?: boolean }) {
  return new ImapFlow({
    host: GMAIL_IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: email, pass },
    logger: false,
    connectionTimeout: CONNECTION_MS,
    greetingTimeout: GREETING_MS,
    socketTimeout: SOCKET_IDLE_MS,
    ...(opts?.verifyOnly === true ? { verifyOnly: true as const } : {}),
  });
}

/**
 * Quick IMAP auth check before persisting credentials. Uses verifyOnly so we disconnect right after login.
 */
export async function verifyGmailImapCredentials(gmailAddress: string, appPassword: string): Promise<
  | { ok: true }
  | {
      ok: false;
      userMessage: string;
    }
> {
  const client = createGmailImapClient(gmailAddress, appPassword, { verifyOnly: true });
  try {
    await client.connect();
    return { ok: true };
  } catch (e) {
    return { ok: false, userMessage: mapImapErrorToUserMessage(e) };
  }
}

/** Map raw IMAP / socket errors to actionable copy for the dashboard. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Connection drops mid-sync — worth a silent retry before surfacing to the user. */
export function isLikelyTransientImapFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('timeout') ||
    m.includes('timed out') ||
    m.includes('econnreset') ||
    m.includes('epipe') ||
    m.includes('socket') ||
    m.includes('etimed') ||
    m.includes('network') ||
    m.includes('aborted') ||
    m.includes('hang up')
  );
}

export function mapImapErrorToUserMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();

  if (
    msg.includes('authentication') ||
    msg.includes('auth') ||
    msg.includes('invalid credentials') ||
    msg.includes('username and password not accepted') ||
    msg.includes('application-specific password') ||
    msg.includes('534-5.7.9') ||
    msg.includes('5.7.9')
  ) {
    return (
      'Gmail did not accept this sign-in. Turn on 2-Step Verification in your Google Account, then create a ' +
      '16-character App Password (not your normal Gmail password). Paste that code here — spaces are OK, we remove them automatically.'
    );
  }

  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('etimedout') ||
    msg.includes('greeting timeout') ||
    msg.includes('connection timed out')
  ) {
    return (
      'Connection to Gmail timed out. Check Wi‑Fi or mobile data and try again. If it keeps failing, try from a stronger network.'
    );
  }

  if (msg.includes('econnreset') || msg.includes('socket hang up') || msg.includes('econnrefused')) {
    return (
      'Could not reach Gmail’s servers. Check your connection and try again. Make sure 2FA is on and you used an App Password, not your regular password.'
    );
  }

  if (msg.includes('certificate') || msg.includes('cert ') || msg.includes('ssl') || msg.includes('tls')) {
    return 'Secure connection to Gmail failed. Check date/time on your device and try again.';
  }

  return (
    'Could not connect to Gmail. Make sure 2-Step Verification is ON, then use a 16-character App Password ' +
    '(not your normal password). Paste the full code — spaces from your phone are fine.'
  );
}
