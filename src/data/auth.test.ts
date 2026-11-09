import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const APP_KEY = 'sb-abc-auth-token';
const fetch = vi.fn();
let saved: Record<string, string>;
let jar: { cookie: string };

beforeEach(() => {
	vi.stubEnv('PUBLIC_GC_RT_supabase_address', 'https://abc.supabase.co');
	vi.stubEnv('PUBLIC_GC_RT_supabase_key', 'anon');
	vi.stubGlobal('fetch', fetch);
	saved = {};
	jar = { cookie: '' };
	vi.stubGlobal('document', jar);
	vi.stubGlobal('localStorage', { getItem: (k: string) => saved[k] ?? null, setItem: (k: string, v: string) => (saved[k] = v) });
});
afterEach(() => {
	fetch.mockReset();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

async function at(hostname: string, protocol = 'https:') {
	vi.stubGlobal('location', { hostname, protocol });
	vi.resetModules();
	return import('./auth');
}

const inSeconds = (s: number) => Math.floor(Date.now() / 1000) + s;
const LATER = inSeconds(3600);
const user = (expires_at = LATER) => ({ access_token: 'a1', refresh_token: 'r1', expires_at, user: { id: 'u1', email: 'u@x.org' } });
const cookieSession = () => JSON.parse(decodeURIComponent(jar.cookie.match(/^gc-ops-session=([^;]*)/)![1]));

test("a company's own address names its space and keeps its own sign-in", async () => {
	const auth = await at('brinkman.getcacheops.org');
	expect(auth.space).toBe('brinkman');
	expect(auth.ownSignIn).toBe(true);
});

test("Get Cache's own site has no space and shares the app's sign-in", async () => {
	const auth = await at('getcache.org');
	expect(auth.space).toBeUndefined();
	expect(auth.ownSignIn).toBe(false);
});

test("on Get Cache's site the session is the app's own stored session while its token is good", async () => {
	const auth = await at('getcache.org');
	expect(auth.session()).toBeNull();
	saved[APP_KEY] = JSON.stringify(user());
	expect(auth.session()).toEqual(user());
	saved[APP_KEY] = JSON.stringify(user(inSeconds(-1)));
	expect(auth.session()).toBeNull();
	saved[APP_KEY] = '{not json';
	expect(auth.session()).toBeNull();
});

test("a code verified on Get Cache's site lands in the app's storage key, and sign-out leaves it there", async () => {
	const auth = await at('getcache.org');
	fetch.mockResolvedValue(Response.json(user()));
	await auth.verifyCode('u@x.org', '123456');
	expect(JSON.parse(saved[APP_KEY])).toEqual(user());
	auth.signOut();
	expect(JSON.parse(saved[APP_KEY])).toEqual(user());
});

test('a code verified on Ops keeps only the session fields in a month-long secure cookie on the parent domain', async () => {
	const auth = await at('brinkman.getcacheops.org');
	fetch.mockResolvedValue(Response.json({ ...user(), extra: 'x', user: { ...user().user, role: 'authenticated' } }));
	await auth.verifyCode('u@x.org', '123456');
	expect(cookieSession()).toEqual(user());
	expect(jar.cookie).toMatch(/; domain=getcacheops\.org; path=\/; max-age=2592000; samesite=lax; secure$/);
	expect(auth.session()).toEqual(user());
	expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual({ type: 'email', email: 'u@x.org', token: '123456' });
	expect(fetch.mock.calls[0][0]).toBe('https://abc.supabase.co/auth/v1/verify');
});

test("Ops' cookie on plain http is not marked secure", async () => {
	const auth = await at('ops.localhost', 'http:');
	fetch.mockResolvedValue(Response.json(user()));
	await auth.verifyCode('u@x.org', '1');
	expect(jar.cookie).toMatch(/; domain=ops\.localhost; .*samesite=lax$/);
});

test("signing out of Ops expires the cookie, and no session is read back", async () => {
	const auth = await at('brinkman.getcacheops.org');
	jar.cookie = `gc-ops-session=${encodeURIComponent(JSON.stringify(user()))}`;
	expect(auth.session()).toEqual(user());
	auth.signOut();
	expect(jar.cookie).toMatch(/^gc-ops-session=; domain=getcacheops\.org; path=\/; max-age=0;/);
	expect(auth.session()).toBeNull();
});

test('with no cookie Ops has no session', async () => {
	const auth = await at('brinkman.getcacheops.org');
	jar.cookie = 'other=1';
	expect(auth.session()).toBeNull();
});

test('a code is sent to the email, making the user if new', async () => {
	const auth = await at('getcache.org');
	fetch.mockResolvedValue(Response.json({}));
	await auth.sendCode('u@x.org');
	const [url, init] = fetch.mock.calls[0];
	expect(url).toBe('https://abc.supabase.co/auth/v1/otp');
	expect(init.method).toBe('POST');
	expect(init.headers).toEqual({ apikey: 'anon', 'content-type': 'application/json' });
	expect(JSON.parse(init.body)).toEqual({ email: 'u@x.org', create_user: true });
});

test.each([
	[{ msg: 'm', error_description: 'd', message: 'e' }, 'm'],
	[{ error_description: 'd', message: 'e' }, 'd'],
	[{ message: 'e' }, 'e'],
	[{}, 'HTTP 400'],
])("a refused sign-in call throws Supabase's own reason %o", async (body, reason) => {
	const auth = await at('getcache.org');
	fetch.mockResolvedValue(Response.json(body, { status: 400 }));
	await expect(auth.sendCode('u@x.org')).rejects.toThrow(new Error(reason));
});

test('a refused sign-in call with no JSON body throws its HTTP status', async () => {
	const auth = await at('getcache.org');
	fetch.mockResolvedValue(new Response('<html>bad gateway', { status: 502 }));
	await expect(auth.sendCode('u@x.org')).rejects.toThrow(new Error('HTTP 502'));
});

test('a session with over a minute left is used as is, never refreshed', async () => {
	const auth = await at('getcache.org');
	const s = user(inSeconds(120));
	saved[APP_KEY] = JSON.stringify(s);
	expect(await auth.fresh()).toEqual(s);
	expect(fetch).not.toHaveBeenCalled();
});

test('a refresh shared by two callers spends the refresh token once and stores the new session', async () => {
	const auth = await at('getcache.org');
	saved[APP_KEY] = JSON.stringify(user(inSeconds(30)));
	const next = { ...user(), access_token: 'a2', refresh_token: 'r2' };
	fetch.mockResolvedValue(Response.json(next));
	const [a, b] = await Promise.all([auth.fresh(), auth.fresh()]);
	expect(a).toEqual(next);
	expect(b).toEqual(next);
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(fetch.mock.calls[0][0]).toBe('https://abc.supabase.co/auth/v1/token?grant_type=refresh_token');
	expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ refresh_token: 'r1' });
	expect(JSON.parse(saved[APP_KEY])).toEqual(next);
	saved[APP_KEY] = JSON.stringify(user(inSeconds(30)));
	await auth.fresh();
	expect(fetch).toHaveBeenCalledTimes(2);
});

test('a refused refresh on Ops warns, signs out and answers no session', async () => {
	const auth = await at('brinkman.getcacheops.org');
	jar.cookie = `gc-ops-session=${encodeURIComponent(JSON.stringify(user(inSeconds(30))))}`;
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	fetch.mockResolvedValue(Response.json({ msg: 'Invalid Refresh Token' }, { status: 400 }));
	expect(await auth.fresh()).toBeNull();
	expect(warn).toHaveBeenCalledWith('[ops] sign-in refresh failed', new Error('Invalid Refresh Token'));
	expect(jar.cookie).toMatch(/^gc-ops-session=; .*max-age=0;/);
});
