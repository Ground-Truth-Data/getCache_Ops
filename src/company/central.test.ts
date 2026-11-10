import { afterEach, expect, test, vi } from 'vitest';

vi.stubEnv('PUBLIC_GC_RT_supabase_address', 'https://abc.supabase.co');
vi.stubEnv('PUBLIC_GC_RT_supabase_key', 'anon');
const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json([]));
vi.stubGlobal('fetch', fetch);
vi.mock('../data/auth', () => ({ fresh: async () => ({ access_token: 't' }) }));
const central = await import('./central');

const answer = (body: unknown, status = 200) => fetch.mockImplementation(async () => Response.json(body, { status }));
const sent = () => fetch.mock.calls.map(([url, init]) => [init?.method, url.replace('https://abc.supabase.co/rest/v1/', ''), init?.body === undefined ? undefined : JSON.parse(String(init.body))]);
const company = (orgKey: string, suiteKey: string | null, inviteKey: string | null) => ({ orgKey, card: {}, role: 'admin', suiteKey, inviteKey });
afterEach(() => {
	fetch.mockReset();
	fetch.mockImplementation(async () => Response.json([]));
	vi.unstubAllEnvs();
	vi.stubEnv('PUBLIC_GC_RT_supabase_address', 'https://abc.supabase.co');
	vi.stubEnv('PUBLIC_GC_RT_supabase_key', 'anon');
	vi.useRealTimers();
});

test("a name check answers Central's one row", async () => {
	answer([{ slug: 'brinkman', taken: false, refused: null }]);
	expect(await central.check('Brinkman')).toEqual({ slug: 'brinkman', taken: false, refused: null });
	expect(sent()).toEqual([['POST', 'rpc/check', { name: 'Brinkman' }]]);
});

test('a space Central does not know answers nothing', async () => {
	expect(await central.space('nobody')).toBeUndefined();
	expect(sent()).toEqual([['POST', 'rpc/space', { slug: 'nobody' }]]);
});

test('a space answers its card', async () => {
	answer([{ orgKey: 'o1', name: 'Brinkman', color: null, logo: null, role: null }]);
	expect(await central.space('brinkman')).toEqual({ orgKey: 'o1', name: 'Brinkman', color: null, logo: null, role: null });
});

test('each company action sends its one call to Central', async () => {
	await central.makeCompany('o1');
	await central.join('tok');
	await central.resetInvite('o1');
	await central.dropFromSuite('f1', true);
	await central.companies();
	await central.members('o1');
	await central.setRole('o1', 'u1', 'member');
	await central.remove('o1', 'u1');
	expect(sent()).toEqual([
		['POST', 'rpc/make_company', { org: 'o1' }],
		['POST', 'rpc/join', { token: 'tok' }],
		['POST', 'rpc/reset_invite', { org: 'o1' }],
		['POST', 'rpc/drop_from_suite', { form: 'f1', dropped: true }],
		['POST', 'rpc/my_companies', {}],
		['GET', 'orgMember?orgKey=eq.o1&order=joinedAt', undefined],
		['PATCH', 'orgMember?orgKey=eq.o1&authId=eq.u1', { role: 'member' }],
		['DELETE', 'orgMember?orgKey=eq.o1&authId=eq.u1', undefined],
	]);
});

test("Central's empty answer is no rows, and a refusal throws Central's reason or its status", async () => {
	fetch.mockImplementation(async () => new Response(null, { status: 204 }));
	expect(await central.remove('o1', 'u1')).toBeNull();
	answer({ message: 'permission denied' }, 403);
	await expect(central.companies()).rejects.toThrow(new Error('permission denied'));
	answer({}, 500);
	await expect(central.companies()).rejects.toThrow(new Error('HTTP 500'));
});

test("a space's address is under ops.localhost in dev and its own getcacheops.org name in prod", () => {
	vi.stubEnv('DEV', true);
	expect(central.spaceUrl('brinkman')).toBe('http://brinkman.ops.localhost:5194/ops/');
	vi.stubEnv('DEV', false);
	expect(central.spaceUrl('brinkman')).toBe('https://brinkman.getcacheops.org/');
});

test("a logo is read from Central's public bucket, and no logo has no address", () => {
	expect(central.logoUrl({ logo: 'o1/logo?v=1' })).toBe('https://abc.supabase.co/storage/v1/object/public/ops-logos/o1/logo?v=1');
	expect(central.logoUrl({ logo: null })).toBe('');
});

test("a company's suite link and invite token come from your own row for it", async () => {
	answer([company('o0', 'nope', 'nope'), company('o1', 's1', 'i1'), company('o2', null, null)]);
	expect(await central.suiteLink('o1')).toBe(`${new URL(central.appHome).origin}/app/inbox/plugin?suite=s1`);
	expect(await central.inviteToken('o1')).toBe('i1');
	expect(await central.suiteLink('o2')).toBeUndefined();
	expect(await central.inviteToken('o2')).toBeUndefined();
	expect(await central.suiteLink('o9')).toBeUndefined();
	expect(await central.inviteToken('o9')).toBeUndefined();
});

test('a logo upload stores the file at one path, then points the company at it with a cache-buster', async () => {
	vi.useFakeTimers({ now: 1_700_000_000_000, toFake: ['Date'] });
	const file = new File(['png'], 'logo.png', { type: 'image/png' });
	answer({});
	await central.uploadLogo('o1', file);
	const [url, init] = fetch.mock.calls[0];
	expect(url).toBe('https://abc.supabase.co/storage/v1/object/ops-logos/o1/logo');
	expect(init?.method).toBe('POST');
	expect(init?.headers).toEqual({ apikey: 'anon', authorization: 'Bearer t', 'content-type': 'image/png', 'x-upsert': 'true' });
	expect(init?.body).toBe(file);
	expect(fetch.mock.calls[1][0]).toBe('https://abc.supabase.co/rest/v1/rpc/set_logo');
	expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ org: 'o1', path: 'o1/logo?v=1700000000000' });
});

test("a refused logo upload throws storage's reason and never points the company at it", async () => {
	answer({ message: 'Payload too large' }, 413);
	await expect(central.uploadLogo('o1', new File(['x'], 'l.png'))).rejects.toThrow(new Error('Payload too large'));
	fetch.mockImplementation(async () => new Response('gateway', { status: 502 }));
	await expect(central.uploadLogo('o1', new File(['x'], 'l.png'))).rejects.toThrow(new Error('HTTP 502'));
	expect(fetch).toHaveBeenCalledTimes(2);
});
