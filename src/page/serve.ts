// Shared by the page-world scripts: answers the content script's requests and
// reports in-app navigations, which isolated content scripts cannot observe.
import {
  NAVIGATE_EVENT,
  REQUEST_EVENT,
  RESPONSE_EVENT,
  type Envelope,
  type Handlers,
  type Reply,
} from '@/shared/protocol';

function handle(handlers: Handlers, request: Envelope): Promise<unknown> {
  switch (request.op) {
    case 'list':
      return handlers.list(request.continuation);
    case 'remove':
      return handlers.remove(request.handle).then(() => null);
    case 'restore':
      return handlers.restore(request.id, request.successor);
  }
}

export function serve(handlers: Handlers) {
  document.addEventListener(REQUEST_EVENT, async (event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (typeof detail !== 'string') return;
    const request = JSON.parse(detail) as Envelope;
    let reply: Reply;
    try {
      reply = { requestId: request.requestId, ok: true, result: await handle(handlers, request) };
    } catch (error) {
      reply = { requestId: request.requestId, ok: false, error: (error as Error).message };
    }
    document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: JSON.stringify(reply) }));
  });

  const announce = () => document.dispatchEvent(new CustomEvent(NAVIGATE_EVENT));
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function (...args: Parameters<History['pushState']>) {
      original.apply(this, args);
      announce();
    };
  }
  addEventListener('popstate', announce);
}

export const cookie = (name: string) =>
  document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ?? null;
