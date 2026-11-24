import { z } from 'zod';
import { REQUEST_EVENT, RESPONSE_EVENT, type Page, type Request } from '@/shared/protocol';

const media = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('image'), url: z.url() }),
  z.object({ kind: z.literal('video'), url: z.url(), poster: z.string() }),
  z.object({
    kind: z.literal('youtube'),
    videoId: z.string(),
    poster: z.url(),
    duration: z.string().nullable(),
    progress: z.number(),
  }),
]);
const item = z.object({
  id: z.string(),
  handle: z.string(),
  author: z.string(),
  title: z.string(),
  text: z.string(),
  info: z.string(),
  url: z.url(),
  media: z.array(media),
});
const page = z.object({ items: z.array(item), continuation: z.string().nullable() });
const reply = z.discriminatedUnion('ok', [
  z.object({ requestId: z.string(), ok: z.literal(true), result: z.unknown() }),
  z.object({ requestId: z.string(), ok: z.literal(false), error: z.string() }),
]);

const TIMEOUT = 20_000;

function send(request: Request): Promise<unknown> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      document.removeEventListener(RESPONSE_EVENT, receive);
    };
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail !== 'string') return;
      const parsed = reply.safeParse(JSON.parse(detail));
      if (!parsed.success || parsed.data.requestId !== requestId) return;
      done();
      if (parsed.data.ok) resolve(parsed.data.result);
      else reject(new Error(parsed.data.error));
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error('Triage lost contact with the page. Reload this tab.'));
    }, TIMEOUT);
    document.addEventListener(RESPONSE_EVENT, receive);
    document.dispatchEvent(
      new CustomEvent(REQUEST_EVENT, { detail: JSON.stringify({ requestId, ...request }) }),
    );
  });
}

export const site = {
  list: async (continuation: string | null): Promise<Page> =>
    page.parse(await send({ op: 'list', continuation })),
  remove: async (handle: string) => {
    await send({ op: 'remove', handle });
  },
  restore: async (id: string, successor: string | null) =>
    z.string().parse(await send({ op: 'restore', id, successor })),
};

export type Site = typeof site;
