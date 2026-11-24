// Runs in YouTube's own JavaScript world, the only place with the InnerTube
// client config (`ytcfg`). Requests are signed the way youtube.com signs its
// own: a SAPISIDHASH derived from the session cookie. Nothing leaves youtube.com.
import { cookie, serve } from '@/page/serve';
import { addedSetVideoId, parsePage } from './parse';

declare const ytcfg: { get(key: string): unknown };

const PLAYLIST = 'WL';

async function authorization() {
  const sapisid = cookie('SAPISID') ?? cookie('__Secure-3PAPISID');
  if (!sapisid) throw new Error('Sign in to YouTube to triage your Watch Later.');
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(`${timestamp} ${sapisid} ${location.origin}`),
  );
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `SAPISIDHASH ${timestamp}_${hex}`;
}

async function innertube(endpoint: string, body: object) {
  const response = await fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      authorization: await authorization(),
      'x-origin': location.origin,
      'x-goog-authuser': String(ytcfg.get('SESSION_INDEX') ?? 0),
    },
    body: JSON.stringify({ context: ytcfg.get('INNERTUBE_CONTEXT'), ...body }),
  });
  if (!response.ok) throw new Error(`YouTube answered ${response.status}.`);
  return response.json();
}

async function edit(actions: object[]) {
  const result = await innertube('browse/edit_playlist', { playlistId: PLAYLIST, actions });
  if (result.status !== 'STATUS_SUCCEEDED') throw new Error('YouTube rejected the change.');
  return result;
}

serve({
  list: async (continuation) =>
    parsePage(
      await innertube('browse', continuation ? { continuation } : { browseId: `VL${PLAYLIST}` }),
    ),
  remove: async (setVideoId) => {
    await edit([{ action: 'ACTION_REMOVE_VIDEO', setVideoId }]);
  },
  restore: async (videoId, successor) => {
    const setVideoId = addedSetVideoId(
      await edit([{ action: 'ACTION_ADD_VIDEO', addedVideoId: videoId }]),
    );
    await edit([
      {
        action: 'ACTION_MOVE_VIDEO_BEFORE',
        setVideoId,
        ...(successor && { movedSetVideoIdSuccessor: successor }),
      },
    ]);
    return setVideoId;
  },
});
