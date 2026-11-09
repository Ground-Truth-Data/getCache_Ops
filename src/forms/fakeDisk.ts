import { vi } from 'vitest';

/** This browser's storage in a test, as a name → bytes map; import it before plugins.ts. */
export const disk = new Map<string, Uint8Array>();
vi.stubGlobal('navigator', {
	storage: {
		getDirectory: async () => ({
			getFileHandle: async (name: string, o?: { create?: boolean }) => {
				if (!disk.has(name) && !o?.create) throw new DOMException('missing', 'NotFoundError');
				return {
					getFile: async () => new Blob([disk.get(name) as Uint8Array<ArrayBuffer>]),
					createWritable: async () => ({ write: async (b: Uint8Array) => void disk.set(name, new Uint8Array(b)), close: async () => {} }),
				};
			},
		}),
	},
});
