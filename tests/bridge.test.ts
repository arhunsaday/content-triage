import { describe, expect, it } from 'vitest';
import { site } from '@/content/bridge';
import { serve } from '@/page/serve';

// Both worlds share the jsdom document, as the content script and page script share the page's.
const calls: string[] = [];
serve({
  list: async (continuation) => {
    calls.push(`list ${continuation}`);
    return { items: [], continuation: null };
  },
  remove: async (handle) => {
    calls.push(`remove ${handle}`);
  },
  restore: async (id, successor) => {
    calls.push(`restore ${id} ${successor}`);
    if (id === 'gone') throw new Error('No such post.');
    return `new-${id}`;
  },
});

describe('bridge', () => {
  it('round-trips every operation, including restore whose request has its own id', async () => {
    await expect(site.list('C')).resolves.toEqual({ items: [], continuation: null });
    await expect(site.remove('H')).resolves.toBeUndefined();
    await expect(site.restore('20', 'NEXT')).resolves.toBe('new-20');
    expect(calls).toEqual(['list C', 'remove H', 'restore 20 NEXT']);
  });

  it('keeps concurrent replies apart', async () => {
    const [a, b] = await Promise.all([site.restore('a', null), site.restore('b', null)]);
    expect([a, b]).toEqual(['new-a', 'new-b']);
  });

  it('rejects with the page-world error', async () => {
    await expect(site.restore('gone', null)).rejects.toThrow('No such post.');
  });
});
