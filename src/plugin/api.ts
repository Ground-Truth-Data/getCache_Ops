import type { Column } from '../data/db';

/** Bump with PLUGIN_API.md: minor when Ops gains a member, major when one changes or goes. */
export const PLUGIN_API_VERSION = '1.0.0';

export interface Ops {
	apiVersion: string;
	/** The open file's PRAGMA user_version. */
	schemaVersion: number;
	/** Read-only: the file is opened with PRAGMA query_only. */
	query(sql: string, bind?: unknown[]): Record<string, unknown>[];
	tables(): { name: string; columns: Column[] }[];
	download(filename: string, data: Blob | string): void;
}

export interface Plugin {
	id: string;
	name: string;
	/** The plugin API major it was built for. */
	api: number;
	/** The oldest Get Cache schema it understands. */
	minSchema: number;
	/** Draws into el; returns its cleanup. */
	mount(el: HTMLElement, ops: Ops): () => void;
}
