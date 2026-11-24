import type { Item, Page } from '@/shared/protocol';
import { walk, type Json } from '../walk';

type Text = { simpleText?: string; runs?: { text: string }[] } | undefined;

const text = (value: Text) => value?.simpleText ?? value?.runs?.map((r) => r.text).join('') ?? '';

function toItem(r: Json): Item | null {
  const videoId = r.videoId;
  const setVideoId = r.setVideoId;
  if (typeof videoId !== 'string' || typeof setVideoId !== 'string') return null;
  const thumbnails = (r.thumbnail as { thumbnails?: { url: string }[] } | undefined)?.thumbnails;
  let progress = 0;
  walk(r.thumbnailOverlays, (o) => {
    const resume = o.thumbnailOverlayResumePlaybackRenderer as
      { percentDurationWatched?: number } | undefined;
    if (resume?.percentDurationWatched) progress = resume.percentDurationWatched;
  });
  return {
    id: videoId,
    handle: setVideoId,
    author: text(r.shortBylineText as Text),
    title: text(r.title as Text),
    text: '',
    info: text(r.videoInfo as Text),
    url: `https://www.youtube.com/watch?v=${videoId}`,
    media: [
      {
        kind: 'youtube',
        videoId,
        poster: thumbnails?.at(-1)?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: text(r.lengthText as Text) || null,
        progress,
      },
    ],
  };
}

// YouTube reshuffles the wrappers around playlist items often; the item and
// continuation renderers themselves are stable, so find them wherever they are.
export function parsePage(response: unknown): Page {
  const items: Item[] = [];
  let continuation: string | null = null;
  walk(response, (node) => {
    const renderer = node.playlistVideoRenderer as Json | undefined;
    const item = renderer && toItem(renderer);
    if (item) items.push(item);
    const token = (node.continuationCommand as { token?: string } | undefined)?.token;
    if (token) continuation = token;
  });
  return { items, continuation };
}

/** The setVideoId YouTube assigned to a video that `edit_playlist` just added. */
export function addedSetVideoId(response: unknown): string {
  let id: string | null = null;
  walk(response, (node) => {
    const added = node.playlistEditVideoAddedResultData as { setVideoId?: string } | undefined;
    if (added?.setVideoId) id = added.setVideoId;
  });
  if (!id) throw new Error('YouTube did not confirm the video was re-added.');
  return id;
}
