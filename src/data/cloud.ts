// The signed-in planter's data, read the way Get Cache pulls its own: the account's
// current.sqlite, downloaded again only when its sha256 changes. Read-only by
// construction: plain GETs and a signed URL, no auth client, so nothing here can
// refresh a token, sign out or write. Contract: getCache/src/lib/docs/OPS_READ.md.

const env = import.meta.env;
const BUCKET = 'mobile-SQLites';
const EVERY_MS = 30_000;

type Session = { access_token: string; user: { id: string; email?: string } };

function session(): Session | null {
	const ref = new URL(env.PUBLIC_GC_RT_supabase_address).hostname.split('.')[0];
	try {
		return JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) ?? 'null');
	} catch {
		return null;
	}
}

/** Who Get Cache is signed in as in this browser, or null. */
export function signedIn(): { authId: string; email: string } | null {
	const s = session();
	return s?.user?.id ? { authId: s.user.id, email: s.user.email ?? '' } : null;
}

/** Storage's folder spelling, from getCache's supabase/functions/_shared/backupPath.ts. */
const folders = (authId: string, email: string) => [
	`${email.trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, '-') || 'no-email'}/${authId}`,
	authId,
];

async function storage(path: string, init?: RequestInit): Promise<Response> {
	const s = session();
	if (!s) throw new Error('signed out of Get Cache');
	return fetch(`${env.PUBLIC_GC_RT_supabase_address}/storage/v1/${path}`, {
		...init,
		headers: { apikey: env.PUBLIC_GC_RT_supabase_key, authorization: `Bearer ${s.access_token}`, 'content-type': 'application/json' },
	});
}

/** RTK1 + 12-byte IV + AES-GCM(gzip(sqlite)), sealed with Get Cache's shared app key. */
export async function unwrapCloud(wrapped: Uint8Array, hex = env.PUBLIC_SHARED_ENCRYPT_KEY): Promise<Uint8Array> {
	if (new TextDecoder().decode(wrapped.subarray(0, 4)) !== 'RTK1') throw new Error('the cloud copy is not RTK1');
	const key = await crypto.subtle.importKey('raw', Uint8Array.from(hex.match(/../g), (h: string) => parseInt(h, 16)), 'AES-GCM', false, ['decrypt']);
	const zipped = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: wrapped.subarray(4, 16) }, key, wrapped.subarray(16));
	return new Uint8Array(await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}

type Copy = { sha: string; bytes: Uint8Array };

/** The account's copy, or null when it is still `sha`. */
async function pull(authId: string, email: string, sha: string): Promise<Copy | null> {
	for (const folder of folders(authId, email)) {
		const path = `${BUCKET}/${folder}/current.sqlite`;
		const info = await storage(`object/info/${path}`);
		if (info.status === 400 || info.status === 404) continue;
		if (!info.ok) throw new Error(`Get Cache's cloud copy: HTTP ${info.status}`);
		const now = String((await info.json()).metadata?.sha256 ?? '');
		if (now && now === sha) return null;
		// Signed, as Get Cache does: the CDN serves an upserted object's old bytes on the authenticated path.
		const signed = await storage(`object/sign/${path}`, { method: 'POST', body: JSON.stringify({ expiresIn: 60 }) });
		if (!signed.ok) throw new Error(`Get Cache's cloud copy: HTTP ${signed.status}`);
		const res = await fetch(`${env.PUBLIC_GC_RT_supabase_address}/storage/v1${(await signed.json()).signedURL}`);
		if (!res.ok) throw new Error(`Get Cache's cloud copy: HTTP ${res.status}`);
		return { sha: now, bytes: await unwrapCloud(new Uint8Array(await res.arrayBuffer())) };
	}
	throw new Error('this account has no cloud copy yet: open Get Cache once while signed in');
}

// Ops' own cache, never Get Cache's database. Get Cache's sign-out wipe deletes it with the rest.
const idb = <T>(run: (s: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode = 'readonly') =>
	new Promise<T>((done, fail) => {
		const open = indexedDB.open('getcache-ops', 1);
		open.onupgradeneeded = () => open.result.createObjectStore('copy');
		open.onerror = () => fail(open.error);
		open.onsuccess = () => {
			const req = run(open.result.transaction('copy', mode).objectStore('copy'));
			req.onsuccess = () => (done(req.result), open.result.close());
			req.onerror = () => fail(req.error);
		};
	});

/** Hands over the cached copy at once, then each newer one: now, on focus, and every 30 s while visible. */
export function follow(onBytes: (bytes: Uint8Array) => void, onError: (e: Error) => void = console.warn): () => void {
	const who = signedIn();
	if (!who) return () => {};
	let sha = '';
	let busy = false;
	const check = async () => {
		if (busy || document.hidden) return;
		busy = true;
		try {
			const copy = await pull(who.authId, who.email, sha);
			if (copy) {
				sha = copy.sha;
				onBytes(copy.bytes);
				await idb((s) => s.put(copy, who.authId), 'readwrite');
			}
		} catch (e) {
			onError(e as Error);
		} finally {
			busy = false;
		}
	};
	idb<Copy | undefined>((s) => s.get(who.authId))
		.then((cached) => cached && ((sha = cached.sha), onBytes(cached.bytes)))
		.catch(onError)
		.finally(check);
	const timer = setInterval(check, EVERY_MS);
	addEventListener('visibilitychange', check);
	return () => (clearInterval(timer), removeEventListener('visibilitychange', check));
}
