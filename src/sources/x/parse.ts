import type { Item, Media, Page } from '@/shared/protocol';
import { walk, type Json } from '../walk';

type XMedia = {
  type: 'photo' | 'video' | 'animated_gif';
  media_url_https: string;
  video_info?: { variants: { content_type: string; bitrate?: number; url: string }[] };
};
type Tweet = {
  rest_id: string;
  core?: { user_results?: { result?: { core?: { name?: string; screen_name?: string } } } };
  legacy?: {
    full_text: string;
    display_text_range?: [number, number];
    created_at: string;
    extended_entities?: { media?: XMedia[] };
  };
  note_tweet?: { note_tweet_results?: { result?: { text?: string } } };
  quoted_status_result?: { result?: unknown };
};

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>' };
const decode = (text: string) => text.replace(/&(?:amp|lt|gt);/g, (e) => ENTITIES[e]);

/** Unwraps the visibility wrapper X puts around some tweets. */
const unwrap = (result: unknown) => {
  const r = result as (Tweet & { tweet?: Tweet }) | undefined;
  return r?.tweet ?? (r?.rest_id ? r : undefined);
};

function body(t: Tweet) {
  const note = t.note_tweet?.note_tweet_results?.result?.text;
  if (note) return decode(note);
  const full = decode(t.legacy?.full_text ?? '');
  // Ranges count code points of the decoded text; the hidden tail is the t.co link to attached media.
  const range = t.legacy?.display_text_range;
  return range ? [...full].slice(range[0], range[1]).join('') : full;
}

function media(t: Tweet): Media[] {
  return (t.legacy?.extended_entities?.media ?? []).map((m) => {
    if (m.type === 'photo') return { kind: 'image', url: `${m.media_url_https}?name=large` };
    const mp4 = (m.video_info?.variants ?? [])
      .filter((v) => v.content_type === 'video/mp4')
      .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
    return mp4
      ? { kind: 'video', url: mp4.url, poster: m.media_url_https }
      : { kind: 'image', url: m.media_url_https };
  });
}

const handle = (t: Tweet) => t.core?.user_results?.result?.core?.screen_name ?? '';

function toItem(t: Tweet): Item {
  const user = t.core?.user_results?.result?.core;
  const quoted = unwrap(t.quoted_status_result?.result);
  const own = media(t);
  return {
    id: t.rest_id,
    handle: t.rest_id,
    author: user ? `${user.name} @${user.screen_name}` : '',
    title: '',
    text: quoted ? `${body(t)}\n\n↪ @${handle(quoted)}: ${body(quoted)}`.trim() : body(t),
    info: t.legacy
      ? new Date(t.legacy.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
      : '',
    url: `https://x.com/${handle(t) || 'i'}/status/${t.rest_id}`,
    media: own.length || !quoted ? own : media(quoted),
  };
}

export function parsePage(response: unknown): Page {
  const items: Item[] = [];
  let bottom: string | null = null;
  walk(response, (node) => {
    const content = node.content as Json | undefined;
    if (content?.cursorType === 'Bottom') bottom = content.value as string;
    const tweet = unwrap((node.tweet_results as { result?: unknown } | undefined)?.result);
    if (tweet && node.itemType === 'TimelineTweet') items.push(toItem(tweet));
  });
  // X keeps handing out a bottom cursor after the last bookmark; an empty page ends the list.
  return { items, continuation: items.length ? bottom : null };
}
