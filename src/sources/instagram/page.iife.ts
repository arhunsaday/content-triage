// Runs in Instagram's own JavaScript world. The saved grid is read from the web API
// instagram.com uses for it; saving and unsaving go through the same Relay mutations
// as Instagram's own Save button, with the signed-in session's tokens.
import { cookie, serve } from '@/page/serve';
import { parsePage, relayDocIds, shortcode, type Mutation } from './parse';

// Instagram's module system; looked up on use, since it may be defined after this script runs.
const page = window as unknown as { require(name: string): unknown };
const loaded = <T>(name: string): T | undefined => {
  try {
    return page.require(name) as T | undefined;
  } catch {
    return undefined;
  }
};
const mutationName = (kind: Mutation) => `usePolarisSaveMedia${kind}Mutation`;

let appId: string | null = null;
function session() {
  appId ??= document.documentElement.innerHTML.match(/"APP_ID":"(\d+)"/)?.[1] ?? null;
  const csrf = cookie('csrftoken');
  const actor = cookie('ds_user_id');
  if (!appId || !csrf || !actor)
    throw new Error('Sign in to Instagram to triage your saved posts.');
  return { appId, csrf, actor };
}

async function api(path: string) {
  const { appId, csrf } = session();
  const response = await fetch(`/api/v1/${path}`, {
    credentials: 'include',
    headers: { 'x-ig-app-id': appId, 'x-csrftoken': csrf, 'x-requested-with': 'XMLHttpRequest' },
  });
  if (!response.ok) throw new Error(`Instagram answered ${response.status}.`);
  return response.json();
}

// Mutation ids change with Instagram's deploys. Pages that show a Save button have them
// loaded; elsewhere (the saved grid) they are read from the scripts a post page loads.
let docIds: Promise<Record<Mutation, string>> | null = null;
function docId(kind: Mutation, mediaId: string) {
  docIds ??= (async () => {
    const save = loaded<string>(`${mutationName('Save')}_instagramRelayOperation`);
    const unsave = loaded<string>(`${mutationName('Unsave')}_instagramRelayOperation`);
    if (save && unsave) return { Save: save, Unsave: unsave };
    const html = await (
      await fetch(`/p/${shortcode(mediaId)}/`, { credentials: 'include' })
    ).text();
    const scripts = new Set(
      [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.js[^"]*)"/g)].map((m) =>
        m[1].replaceAll('&amp;', '&'),
      ),
    );
    const found: Partial<Record<Mutation, string>> = {};
    await Promise.all(
      [...scripts].map(async (url) =>
        Object.assign(found, relayDocIds(await (await fetch(url)).text())),
      ),
    );
    if (!found.Save || !found.Unsave)
      throw new Error('Instagram changed how it saves posts. Triage needs an update.');
    return found as Record<Mutation, string>;
  })().catch((error) => {
    docIds = null;
    throw error;
  });
  return docIds.then((ids) => ids[kind]);
}

async function mutate(kind: Mutation, mediaId: string) {
  const { appId, csrf, actor } = session();
  const fb_dtsg = loaded<{ token: string }>('DTSGInitialData')?.token;
  const lsd = loaded<{ token: string }>('LSD')?.token;
  if (!fb_dtsg || !lsd) throw new Error('Reload this Instagram tab and try again.');
  const name = mutationName(kind);
  const response = await fetch('/api/graphql', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-csrftoken': csrf,
      'x-fb-friendly-name': name,
      'x-fb-lsd': lsd,
      'x-ig-app-id': appId,
    },
    body: new URLSearchParams({
      av: actor,
      __user: '0',
      __a: '1',
      fb_dtsg,
      // Instagram's checksum of the token: "2" followed by the sum of its char codes.
      jazoest: `2${[...fb_dtsg].reduce((sum, c) => sum + c.charCodeAt(0), 0)}`,
      lsd,
      fb_api_caller_class: 'RelayModern',
      fb_api_req_friendly_name: name,
      server_timestamps: 'true',
      doc_id: await docId(kind, mediaId),
      variables: JSON.stringify({
        input: { actor_id: actor, client_mutation_id: '1', media_id: mediaId },
      }),
    }),
  });
  if (!response.ok) throw new Error(`Instagram answered ${response.status}.`);
  const result = JSON.parse((await response.text()).replace(/^for \(;;\);/, ''));
  if (result.errors?.length || !result.data) throw new Error('Instagram rejected the change.');
}

serve({
  list: async (maxId) =>
    parsePage(await api(`feed/saved/posts/${maxId ? `?max_id=${encodeURIComponent(maxId)}` : ''}`)),
  remove: (id) => mutate('Unsave', id),
  restore: async (id) => {
    await mutate('Save', id);
    return id;
  },
});
