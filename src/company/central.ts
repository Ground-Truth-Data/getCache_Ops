// Companies in Central's ops schema, read and written with the signed-in planter's token (anon when signed
// out): row-level security and triggers there decide what is allowed, never this file.
import { session } from '../data/auth';

const env = import.meta.env;

export type Role = 'admin' | 'crew' | 'follower' | 'asked';
export type Company = { id: string; name: string; slug: string; status: 'draft' | 'approved' | 'rejected'; logo: string | null };
export type Space = Omit<Company, 'slug'> & { role: Role | null };
export type Member = { companyId: string; authId: string; role: Role; email: string; joinedAt: string };
export type Invite = { token: string; createdAt: string };

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
	const res = await fetch(`${env.PUBLIC_GC_RT_supabase_address}/rest/v1/${path}`, {
		method,
		headers: {
			apikey: env.PUBLIC_GC_RT_supabase_key,
			authorization: `Bearer ${session()?.access_token ?? env.PUBLIC_GC_RT_supabase_key}`,
			'accept-profile': 'ops',
			'content-profile': 'ops',
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

/** A company's own address; dev serves Ops under /ops/ on every host. */
export const spaceUrl = (slug: string) => (import.meta.env.DEV ? `http://${slug}.ops.localhost:5194/ops/` : `https://${slug}.getcacheops.org/`);

export const logoUrl = (c: { logo: string | null }) => (c.logo ? `${env.PUBLIC_GC_RT_supabase_address}/storage/v1/object/public/ops-logos/${c.logo}` : '');

/** The address a name would get, and who already holds it or one like it, or why the name is refused. */
export const check = (name: string) => one(call<{ slug: string; takenId: string | null; takenName: string | null; refused: string | null }[]>('rpc/check', 'POST', { name }));
export const create = (name: string) => one(call<Company[]>('company', 'POST', { name }));
export const space = (slug: string) => one(call<Space[]>('rpc/space', 'POST', { slug }));
export const join = (token: string) => call<string>('rpc/join', 'POST', { token });
export const ask = (companyId: string, authId: string) => call('companyMember', 'POST', { companyId, authId, role: 'asked' });

export const mine = (authId: string) =>
	call<(Member & { company: Company | null })[]>(`companyMember?authId=eq.${authId}&select=*,company(id,name,slug,status,logo)&order=joinedAt`);
export const members = (companyId: string) => call<Member[]>(`companyMember?companyId=eq.${companyId}&order=joinedAt`);
export const setRole = (companyId: string, authId: string, role: Role) => call(`companyMember?companyId=eq.${companyId}&authId=eq.${authId}`, 'PATCH', { role });
export const remove = (companyId: string, authId: string) => call(`companyMember?companyId=eq.${companyId}&authId=eq.${authId}`, 'DELETE');

export const invites = (companyId: string) => call<Invite[]>(`companyInvite?companyId=eq.${companyId}&order=createdAt`);
export const invite = (companyId: string) => call('companyInvite', 'POST', { companyId });
export const withdraw = (token: string) => call(`companyInvite?token=eq.${token}`, 'DELETE');

export const isApprover = async (authId: string) => (await call<unknown[]>(`approver?authId=eq.${authId}`)).length > 0;
export const drafts = () => call<(Company & { createdAt: string })[]>('company?status=eq.draft&order=createdAt');
export const decide = (id: string, status: 'approved' | 'rejected') => call(`company?id=eq.${id}`, 'PATCH', { status });

export async function uploadLogo(companyId: string, file: File) {
	const path = `${companyId}/logo`;
	const res = await fetch(`${env.PUBLIC_GC_RT_supabase_address}/storage/v1/object/ops-logos/${path}`, {
		method: 'POST',
		headers: { apikey: env.PUBLIC_GC_RT_supabase_key, authorization: `Bearer ${session()?.access_token}`, 'content-type': file.type, 'x-upsert': 'true' },
		body: file,
	});
	if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `HTTP ${res.status}`);
	// The query string is the cache-buster: the object keeps one path for life.
	await call(`company?id=eq.${companyId}`, 'PATCH', { logo: `${path}?v=${Date.now()}` });
}
