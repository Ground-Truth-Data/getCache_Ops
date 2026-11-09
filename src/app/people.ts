import type { Identity } from '../../_rapper/gc/IdentityPill.svelte';
import { isOpen, query } from '../data/db';

/** A column headed with one of these holds people's names, and each cell is drawn as that person's pill. */
export const PERSON_NAME = /^(name|planter|surveyor|by)$|.+ by$/;

/** Each contact by the name the reports print, coloured as the app colours them; this phone's owner is "you". */
export function people(): Map<string, Identity> {
	if (!isOpen()) return new Map();
	const self = query("SELECT selfKey FROM appState WHERE appStateId = 'singleton'")[0]?.selfKey;
	return new Map(
		query("SELECT personKey, coalesce(nullif(alias, ''), username) AS name, color, colorPickedAt FROM personView").map((r) => [
			r.name as string,
			r.personKey === self ? { label: 'you', color: 'var(--accent)', self: true, picked: false } : { label: r.name as string, color: (r.color as string) ?? '', self: false, picked: !!r.colorPickedAt },
		]),
	);
}
