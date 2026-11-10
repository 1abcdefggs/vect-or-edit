/**
 * Outbound network policy (default deny) for the whole app.
 *
 * Every http(s) and ws(s) request made through Chromium's network stack is checked here before it leaves:
 * renderer pages and workers, `net.request` / `net.fetch` in the main process, and electron-updater
 * (which uses its own session). Anything not on the allowlist is cancelled and logged by host only.
 *
 * Not covered: Node's own `fetch`, `http` and `https` in the main process bypass Chromium and therefore
 * this policy. Main-process code must use `net.request` / `net.fetch` (the Gemini SDK is given `net.fetch`
 * through `httpOptions.fetch`); a test in `__tests__/egressPolicy.test.ts` keeps Node network APIs out of src/main.
 *
 * Public surface: installEgressPolicy, withAiEgress, AI_HOSTS, decideEgress (pure, for tests).
 */
import { app, session, type Session } from 'electron';

/** Which session a request came from: the app's default session or electron-updater's own one. */
export type EgressZone = 'app' | 'updater';

export interface EgressState {
  zone: EgressZone;
  /** true when the app is not packaged: the Vite dev server on localhost is then allowed */
  isDev: boolean;
  /** true when the request comes from the main process (no webContents): only main may reach AI hosts */
  fromMain: boolean;
  /** AI hosts with a send in progress (opened by withAiEgress) */
  openAiHosts: { has(host: string): boolean };
}

/** The cloud LLM endpoints. They are reachable only while withAiEgress runs for that host. */
export const AI_HOSTS = {
  claude: 'api.anthropic.com',
  openai: 'api.openai.com',
  gemini: 'generativelanguage.googleapis.com'
} as const;

export type AiHost = typeof AI_HOSTS[keyof typeof AI_HOSTS];

// A leading "*." matches subdomains only; a bare name matches that host only.
const APP_HOSTS: readonly string[] = [
  // Embedding model download (Transformers.js); file downloads redirect to the CDN hosts on both domains
  'huggingface.co', '*.huggingface.co', 'hf.co', '*.hf.co',
  // Web fonts linked from index.html
  'fonts.googleapis.com', 'fonts.gstatic.com'
];

// electron-updater (GitHub provider): release feed on github.com, asset downloads redirect to githubusercontent.com
const UPDATER_HOSTS: readonly string[] = ['github.com', 'api.github.com', '*.githubusercontent.com'];

const DEV_HOSTS: readonly string[] = ['localhost', '127.0.0.1'];

const NETWORK_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);
const AI_HOST_SET: ReadonlySet<string> = new Set(Object.values(AI_HOSTS));

function matchesHost(host: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => p.startsWith('*.') ? host.endsWith(p.slice(1)) : host === p);
}

/** Pure decision: true when the request may leave. Non-network schemes (file:, devtools:, data:, blob:) are not this policy's concern. */
export function decideEgress(url: string, state: EgressState): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!NETWORK_SCHEMES.has(parsed.protocol)) return true;

  const host = parsed.hostname.toLowerCase();
  if (state.isDev && matchesHost(host, DEV_HOSTS)) return true;
  if (state.zone === 'updater') return matchesHost(host, UPDATER_HOSTS);
  // AI sends live in aiServices.ts (main process); a page or worker never reaches an AI host, even during a send
  if (AI_HOST_SET.has(host)) return parsed.protocol === 'https:' && state.fromMain && state.openAiHosts.has(host);
  return matchesHost(host, APP_HOSTS);
}

// Counted, so overlapping sends to the same host keep it open until the last one ends
const aiSendsInFlight = new Map<string, number>();
const openAiHosts = { has: (host: string) => aiSendsInFlight.has(host) };

/**
 * Opens one AI host for the duration of fn and closes it afterwards, whether fn resolves or throws.
 * Every cloud LLM send goes through this; a request to an AI host outside it is cancelled.
 */
export async function withAiEgress<T>(host: AiHost, fn: () => Promise<T>): Promise<T> {
  aiSendsInFlight.set(host, (aiSendsInFlight.get(host) ?? 0) + 1);
  try {
    return await fn();
  } finally {
    const left = (aiSendsInFlight.get(host) ?? 1) - 1;
    if (left > 0) aiSendsInFlight.set(host, left);
    else aiSendsInFlight.delete(host);
  }
}

function attach(ses: Session, zone: EgressZone, isDev: boolean): void {
  // A session holds one onBeforeRequest listener; registering here replaces any earlier one, and any later
  // registration elsewhere would silently drop this policy (a test keeps onBeforeRequest out of other src/main files)
  ses.webRequest.onBeforeRequest((details, callback) => {
    const fromMain = details.webContentsId === undefined;
    const allowed = decideEgress(details.url, { zone, isDev, fromMain, openAiHosts });
    if (!allowed) {
      let host = '(invalid url)';
      try { host = new URL(details.url).host; } catch { /* keep the placeholder */ }
      // Host and resource type only: paths and queries can carry document text or keys
      console.warn(`[Egress] Blocked ${details.resourceType} request to ${host} (${zone})`);
    }
    callback({ cancel: !allowed });
  });
}

/** Installs the policy on the default session and on electron-updater's session. Call once, before any window or request. */
export function installEgressPolicy(): void {
  const isDev = !app.isPackaged;
  attach(session.defaultSession, 'app', isDev);
  // Same partition name as electron-updater's ElectronHttpExecutor (NET_SESSION_NAME), so both refer to one session
  attach(session.fromPartition('electron-updater', { cache: false }), 'updater', isDev);
}
