// Who is signed in. On Get Cache's own site Ops borrows the app's session and never refreshes it: a second
// refresher would spend the same single-use refresh token and sign the app out. On getcacheops.org, which cannot
// see that session, Ops signs in itself with an emailed code and keeps the session in a cookie on the parent
// domain, so one sign-in covers every company's address.

const env = import.meta.env;
const host = globalThis.location?.hostname ?? '';
const parts = host.match(/^(?:([a-z0-9-]+)\.)?(ops\.localhost|getcacheops\.org)$/);
/** The company whose address this is: brinkman.getcacheops.org → brinkman. */
export const space = parts?.[1];
/** True where Ops keeps its own sign-in. */
export const ownSignIn = !!parts;

export type Session = { access_token: string; refresh_token?: string; expires_at: number; user: { id: string; email?: string } };

const COOKIE = 'gc-ops-session';

function stored(): Session | null {
	try {
		if (ownSignIn) {
			const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
			return m ? JSON.parse(decodeURIComponent(m[1])) : null;
		}
		// Unset on a fork's own domain, where there is no Get Cache session to share.
		const ref = new URL(env.PUBLIC_GC_RT_supabase_address).hostname.split('.')[0];
		return JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) ?? 'null');
	} catch {
		return null;
	}
}

function keep(s: Session | null) {
	const v = s ? encodeURIComponent(JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user: { id: s.user.id, email: s.user.email } })) : '';
	document.cookie = `${COOKIE}=${v}; domain=${parts![2]}; path=/; max-age=${s ? 30 * 86400 : 0}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
}

/** The session while its token is good. */
export function session(): Session | null {
	const s = stored();
	return s && s.expires_at * 1000 > Date.now() ? s : null;
}

async function auth(path: string, body: object): Promise<Session> {
	const res = await fetch(`${env.PUBLIC_GC_RT_supabase_address}/auth/v1/${path}`, {
		method: 'POST',
		headers: { apikey: env.PUBLIC_GC_RT_supabase_key, 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(json.msg ?? json.error_description ?? json.message ?? `HTTP ${res.status}`);
	return json;
}

let refreshing: Promise<Session | null> | undefined;

/** Ops' own session, refreshed when it has under a minute left. Where the app owns the session, just reads it.
 *  Callers share one refresh: a refresh token is spent on first use. */
export function fresh(): Promise<Session | null> {
	const s = stored();
	if (!ownSignIn || !s?.refresh_token || s.expires_at * 1000 - Date.now() > 60_000) return Promise.resolve(session());
	return (refreshing ??= auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token })
		.then((next) => (keep(next), next))
		.catch((e) => (console.warn('[ops] sign-in refresh failed', e), keep(null), null))
		.finally(() => (refreshing = undefined)));
}

export const sendCode = (email: string) => auth('otp', { email, create_user: true });

export async function verifyCode(email: string, token: string) {
	keep(await auth('verify', { type: 'email', email, token }));
}

export const signOut = () => keep(null);
