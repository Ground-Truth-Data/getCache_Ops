// Stands in for Get Cache's paraglide, which Ops doesn't build: rapper's furniture reads its English strings straight from the catalogue.
import en from '../../_rapper/gc/messages/en.json';

const say = (k: string) => (p: Record<string, unknown> = {}) => (en as Record<string, string>)[k].replace(/\{(\w+)\}/g, (_, n) => String(p[n]));
export const m = new Proxy({} as Record<string, ReturnType<typeof say>>, { get: (_, k: string) => say(k) });
export const getLocale = () => 'en';
