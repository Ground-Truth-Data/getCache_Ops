/** Asks a Get Cache tab on this origin for its database; every reply reaches onBytes. */
export function askGetCache(onBytes: (bytes: Uint8Array) => void) {
	const channel = new BroadcastChannel('getcache-ops');
	channel.onmessage = (e) => e.data?.op === 'bytes' && onBytes(e.data.bytes);
	const ask = () => channel.postMessage({ op: 'export' });
	ask();
	return { ask, close: () => channel.close() };
}
