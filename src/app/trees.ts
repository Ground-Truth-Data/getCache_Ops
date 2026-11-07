/** The pine, U+E001 of the ReTreever font: app.css draws it wherever it appears in Ops' text, charts included. */
export const TREE = '';

/** A report column of tree counts, by name. "delivered" also names a date column, so only a number gets the pine. */
export const TREE_NAME = /^(trees( planted)?|planted|allocated|calculated|delivered|in caches|excess|trees\/(box|bundle))$/i;

/** A tree count as Ops shows it: the pine, then the number. */
export const trees = (n: unknown) => `${TREE}${typeof n === 'number' ? n.toLocaleString() : n}`;
