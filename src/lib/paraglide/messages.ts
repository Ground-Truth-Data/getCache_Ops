import en from '../../../_rapper/gc/messages/en.json';

// The strings rapper/gc reaches for through $parent: rapper's own English, so a new one never goes missing here.
type Message = (params?: Record<string, unknown>) => string;
// inlang's plural form: `local <name> = <input>: plural`, then a match keyed `<name>=<category>` or `<name>=*`.
type Variants = { declarations: string[]; match: Record<string, string> }[];
const plural = new Intl.PluralRules('en');
const fill = (text: string, params: Record<string, unknown>) => text.replace(/\{(\w+)\}/g, (_, name) => String(params[name]));
const pick = ([v]: Variants, params: Record<string, unknown>) => {
	const [, name, input] = v.declarations.map((d) => d.match(/^local (\w+) = (\w+): plural$/)).find(Boolean)!;
	return v.match[`${name}=${plural.select(Number(params[input]))}`] ?? v.match[`${name}=*`];
};
export const m: Record<string, Message> = Object.fromEntries(
	Object.entries(en as Record<string, string | Variants>).map(([key, text]): [string, Message] => [
		key,
		(params = {}) => fill(typeof text === 'string' ? text : pick(text, params), params),
	]),
);
