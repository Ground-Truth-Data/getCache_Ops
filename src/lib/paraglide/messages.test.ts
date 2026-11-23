import { expect, it } from 'vitest';
import { m } from './messages';

it("reads rapper's plural messages, not only plain strings", () => {
	expect(m.gc_plugin_questions({ count: 1, shown: '1' })).toBe('1 question');
	expect(m.gc_plugin_questions({ count: 3, shown: '3' })).toBe('3 questions');
	expect(m.gc_plugin_submissions({ count: 0, shown: '0' })).toBe('0 submissions');
});
