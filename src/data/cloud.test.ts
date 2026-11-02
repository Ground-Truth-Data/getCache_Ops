import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { unwrapCloud } from './cloud';

const sample = readFileSync(new URL('../../public/sample.sqlite', import.meta.url));

test("opens Get Cache's cloud copy: RTK1, IV, AES-GCM over gzip", async () => {
	const hex = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
	const key = await crypto.subtle.importKey('raw', Buffer.from(hex, 'hex'), 'AES-GCM', false, ['encrypt']);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, gzipSync(sample)));
	const wrapped = Buffer.concat([Buffer.from('RTK1'), iv, sealed]);
	expect(Buffer.from(await unwrapCloud(wrapped, hex)).equals(sample)).toBe(true);
	await expect(unwrapCloud(sample, hex)).rejects.toThrow('not RTK1');
});
