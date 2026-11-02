export type Reply = { bytes: Uint8Array; signedIn?: boolean; syncedAt?: string | null };

/** Asks a Get Cache tab on this origin for its database; every reply reaches onReply. */
export function askGetCache(onReply: (reply: Reply) => void) {
	const channel = new BroadcastChannel('getcache-ops');
	channel.onmessage = (e) => e.data?.op === 'bytes' && onReply(e.data);
	const ask = () => channel.postMessage({ op: 'export' });
	ask();
	return { ask, close: () => channel.close() };
}
