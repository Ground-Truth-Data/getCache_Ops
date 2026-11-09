import starter from '../starters/report/report.js?url';

/** A company's report: Ops keeps only this, and fetches the code from `url` each time it opens. */
export type Report = { id: string; name: string; url: string; tables: string[] };

const own = import.meta.glob<Report>('../../custom/reports/*.json', { eager: true, import: 'default' });
export const reports: Report[] = [
	...Object.values(own),
	...(import.meta.env.DEV ? [{ id: 'starter', name: 'Sample report', url: starter, tables: ['bagUpView', 'tallyView'] }] : []),
];

// Ops' own code, run first in the same script as the company's, so no realm in the box runs one without the other:
// CSP does not cover WebRTC in Chromium or WebKit.
const PREAMBLE = 'for (const k of Object.getOwnPropertyNames(window)) if (/RTC|WebTransport/.test(k)) delete window[k];\n';

/**
 * The box's whole page. Its CSP lives in its own text and runs only this one script, by hash: no network, no eval,
 * no frames or workers, images only from data and blob. Ops' own page forbids frames navigating anywhere.
 */
export async function srcdoc(code: string): Promise<string> {
	const script = PREAMBLE + code.replace(/<\/(script)/gi, '<\\/$1');
	const hash = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(script)))));
	const csp = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'`;
	return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><body><script>${script}</script>`;
}

/** Ops' answer to one request from the box: rows of a table the report was allowed, and nothing else. */
export function answer(report: Report, data: unknown, query: (sql: string) => Record<string, unknown>[]): object | undefined {
	const { id, rows } = (data ?? {}) as { id?: unknown; rows?: unknown };
	if (typeof id !== 'number' || typeof rows !== 'string') return;
	if (!report.tables.includes(rows)) return { id, error: `${report.name} was not allowed ${rows}.` };
	try {
		return { id, rows: query(`SELECT * FROM "${rows.replaceAll('"', '""')}"`) };
	} catch (e) {
		return { id, error: (e as Error).message };
	}
}
