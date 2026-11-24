// Contract between the isolated content script (UI) and the page-world script
// that talks to the site. Payloads cross worlds as JSON strings: Firefox does not
// share object `detail`s between worlds.
export const REQUEST_EVENT = 'triage:request';
export const RESPONSE_EVENT = 'triage:response';
/** Fired by the page world after every in-app navigation (all three sites are SPAs). */
export const NAVIGATE_EVENT = 'triage:navigate';

export type Media =
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string; poster: string }
  /** Plays through YouTube's embedded player; `progress` is the percent already watched. */
  | { kind: 'youtube'; videoId: string; poster: string; duration: string | null; progress: number };

export type Item = {
  /** Stable id of the content: video, tweet or Instagram media id. */
  id: string;
  /** What removal needs. Equals `id` except on YouTube, where it is the playlist entry id. */
  handle: string;
  author: string;
  title: string;
  text: string;
  info: string;
  url: string;
  media: Media[];
};

export type Page = { items: Item[]; continuation: string | null };

export type Request =
  | { op: 'list'; continuation: string | null }
  | { op: 'remove'; handle: string }
  /**
   * Puts a removed item back and returns its new handle. YouTube places it right before
   * `successor` (the next item's handle, or the end when null); X and Instagram cannot
   * reorder, so it comes back as the newest bookmark or save.
   */
  | { op: 'restore'; id: string; successor: string | null };

/** Request ids live apart from the request, which has an `id` of its own. */
export type Envelope = { requestId: string } & Request;

export type Reply = { requestId: string } & (
  { ok: true; result: unknown } | { ok: false; error: string }
);

export type Handlers = {
  list(continuation: string | null): Promise<Page>;
  remove(handle: string): Promise<void>;
  restore(id: string, successor: string | null): Promise<string>;
};
