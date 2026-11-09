// Companies: a Get Cache organization (its orgKey) made a company, its facts on that organization's own row and
// read and written through Central's ops functions with the signed-in planter's token (anon when signed out).
// Row-level security and those functions decide what is allowed, never this file.
import { fresh } from '../data/auth';

const env = import.meta.env;

export type Role = 'admin' | 'member' | 'requested';
/** A company is an organization in Contacts; this is its card as Central reads it off that row. */
export type Card = { orgKey: string; name: string; slug: string; color: string | null; logo: string | null };
export type Company = { orgKey: string; card: Card; role: Role; suiteKey: string | null; inviteKey: string | null };
export type Space = Omit<Card, 'slug'> & { role: Role | null };
export type Member = { orgKey: string; authId: string; role: Role; email: string; joinedAt: string };

export async function call<T>(path: string, method = 'GET', body?: unknown, profile = 'ops'): Promise<T> {
	const res = await fetch(`${env.PUBLIC_GC_RT_supabase_address}/rest/v1/${path}`, {
		method,
		headers: {
			apikey: env.PUBLIC_GC_RT_supabase_key,
			authorization: `Bearer ${(await fresh())?.access_token ?? env.PUBLIC_GC_RT_supabase_key}`,
			'accept-profile': profile,
			'content-profile': profile,
			'content-type': 'application/json',
			prefer: 'return=representation',
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const json = res.status === 204 ? null : await res.json();
	if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
	return json;
}

const one = async <T>(rows: Promise<T[]>): Promise<T | undefined> => (await rows)[0];

/** A space's own address; dev serves Ops under /ops/ on every host. */
export const spaceUrl = (slug: string) => (import.meta.env.DEV ? `http://${slug}.ops.localhost:5194/ops/` : `https://${slug}.getcacheops.org/`);

/** Ops' own home, where the Organizations page lives, and the Get Cache app a joiner goes back to. */
export const opsHome = import.meta.env.DEV ? 'http://ops.localhost:5194/ops/' : 'https://getcacheops.org/';
export const appHome = import.meta.env.DEV ? 'http://getcache.localhost:5173/app/menu' : 'https://getcache.org/app/menu';

export const logoUrl =(c: { logo: string | null }) => (c.logo ? `${env.PUBLIC_GC_RT_supabase_address}/storage/v1/object/public/ops-logos/${c.logo}` : '');

/** The address a name would get, whether it or a look-alike is taken (never by whom), or why it is refused. */
export const check = (name: string) => one(call<{ slug: string | null; taken: boolean | null; refused: string | null }[]>('rpc/check', 'POST', { name }));
/** One of your own organizations becomes a company, live at once. */
export const makeCompany = (orgKey: string) => call<string>('rpc/make_company', 'POST', { org: orgKey });
export const space = (slug: string) => one(call<Space[]>('rpc/space', 'POST', { slug }));
/** Opening the invite link signed in sends a join request; an admin approves it. */
export const join = (token: string) => call<string>('rpc/join', 'POST', { token });

/** The companies you are in or asked to join, with the links your role holds. */
export const companies = () => call<Company[]>('rpc/my_companies', 'POST', {});
const mineOf = async (orgKey: string) => (await companies()).find((c) => c.orgKey === orgKey);
export const members = (orgKey: string) => call<Member[]>(`orgMember?orgKey=eq.${orgKey}&order=joinedAt`);
export const setRole = (orgKey: string, authId: string, role: Role) => call(`orgMember?orgKey=eq.${orgKey}&authId=eq.${authId}`, 'PATCH', { role });
export const remove = (orgKey: string, authId: string) => call(`orgMember?orgKey=eq.${orgKey}&authId=eq.${authId}`, 'DELETE');

/** The company's public suite link: every form it publishes, read-only, no sign-in. */
export const suiteLink = async (orgKey: string) => {
	const key = (await mineOf(orgKey))?.suiteKey;
	return key ? `${new URL(appHome).origin}/app/plugin?suite=${key}` : undefined;
};
/** A dropped form greys on phones; nothing is deleted, and it can come back. */
export const dropFromSuite = (form: string, dropped: boolean) => call('rpc/drop_from_suite', 'POST', { form, dropped });

export const inviteToken = async (orgKey: string) => (await mineOf(orgKey))?.inviteKey ?? undefined;
/** A new link; the old one stops working at once. */
export const resetInvite = (orgKey: string) => call<string>('rpc/reset_invite', 'POST', { org: orgKey });

export async function uploadLogo(orgKey: string, file: File) {
	const path = `${orgKey}/logo`;
	const res = await fetch(`${env.PUBLIC_GC_RT_supabase_address}/storage/v1/object/ops-logos/${path}`, {
		method: 'POST',
		headers: { apikey: env.PUBLIC_GC_RT_supabase_key, authorization: `Bearer ${(await fresh())?.access_token}`, 'content-type': file.type, 'x-upsert': 'true' },
		body: file,
	});
	if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `HTTP ${res.status}`);
	// The query string is the cache-buster: the object keeps one path for life.
	await call('rpc/set_logo', 'POST', { org: orgKey, path: `${path}?v=${Date.now()}` });
}
