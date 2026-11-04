export interface Brand {
	name: string;
	/** Image URLs shown in place of the name; custom/brand.ts imports its own files. */
	logos: string[];
	/** The browser tab's icon. */
	icon: string;
	accent: string;
}

const defaults: Brand = { name: 'Get Cache Ops', logos: ['logo_getCache_join.webp', 'logo_ops_join.webp'], icon: 'favicon.png', accent: '#ffd700' };

const custom = Object.values(import.meta.glob<{ default: Partial<Brand> }>('../custom/brand.ts', { eager: true }))[0];

/** custom/brand.ts over the defaults; the file is optional. */
export const brand: Brand = { ...defaults, ...custom?.default };
