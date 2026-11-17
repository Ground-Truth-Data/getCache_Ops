import en from '../../../_rapper/gc/messages/en.json';

// The strings rapper/gc reaches for through $parent: rapper's own English, so a new one never goes missing here.
type Message = (params?: Record<string, unknown>) => string;
export const m: Record<string, Message> = Object.fromEntries(
	Object.entries(en).map(([key, text]): [string, Message] => [key, (params = {}) => text.replace(/\{(\w+)\}/g, (_, name) => String(params[name]))]),
);
