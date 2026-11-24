import type { Item, Media, Page } from '@/shared/protocol';

type Candidate = { url: string; width: number; height: number };
type Node = {
  id: string;
  media_type: 1 | 2 | 8;
  image_versions2?: { candidates: Candidate[] };
  video_versions?: Candidate[];
  carousel_media?: Node[];
};
type Post = Node & {
  code: string;
  product_type?: string;
  taken_at: number;
  user: { username: string };
  caption?: { text: string } | null;
};
type Feed = { items: { media: Post }[]; more_available: boolean; next_max_id?: string };

// Candidates arrive largest first.
const poster = (n: Node) => n.image_versions2?.candidates[0]?.url ?? '';

function media(n: Node): Media[] {
  if (n.media_type === 8) return (n.carousel_media ?? []).flatMap(media);
  const video = n.video_versions?.[0]?.url;
  if (video) return [{ kind: 'video', url: video, poster: poster(n) }];
  return poster(n) ? [{ kind: 'image', url: poster(n) }] : [];
}

/** "<media id>_<owner id>": the media id is what save and unsave take. */
const mediaId = (post: Post) => post.id.split('_')[0];

export function parsePage(response: unknown): Page {
  const feed = response as Feed;
  return {
    items: feed.items.map(({ media: post }) => ({
      id: mediaId(post),
      handle: mediaId(post),
      author: post.user.username,
      title: '',
      text: post.caption?.text ?? '',
      info: new Date(post.taken_at * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' }),
      url: `https://www.instagram.com/${post.product_type === 'clips' ? 'reel' : 'p'}/${post.code}/`,
      media: media(post),
    })),
    continuation: feed.more_available && feed.next_max_id ? feed.next_max_id : null,
  };
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** The shortcode in a post's URL is its media id in base 64. */
export function shortcode(mediaId: string) {
  let code = '';
  for (let n = BigInt(mediaId); n > 0n; n /= 64n) code = ALPHABET[Number(n % 64n)] + code;
  return code;
}

export type Mutation = 'Save' | 'Unsave';

/** The persisted-query ids of the save and unsave mutations defined in a script. */
export function relayDocIds(source: string): Partial<Record<Mutation, string>> {
  const ids: Partial<Record<Mutation, string>> = {};
  for (const m of source.matchAll(
    /__d\("usePolarisSaveMedia(Save|Unsave)Mutation_instagramRelayOperation",\[\],\(function\([^)]*\)\{[^}]*?exports="(\d+)"/g,
  ))
    ids[m[1] as Mutation] = m[2];
  return ids;
}
