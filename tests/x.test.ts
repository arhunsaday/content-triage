import { describe, expect, it } from 'vitest';
import { parsePage } from '@/sources/x/parse';

const user = (screen_name: string) => ({
  user_results: { result: { core: { name: `Name ${screen_name}`, screen_name } } },
});

const tweet = (id: string, extra: object = {}) => ({
  rest_id: id,
  core: user('alice'),
  legacy: {
    full_text: 'Hello &amp; welcome 👋 https://t.co/media',
    display_text_range: [0, 17],
    created_at: 'Wed Nov 18 17:24:56 +0000 2026',
  },
  ...extra,
});

const entry = (result: object) => ({
  entryId: `tweet-${Math.random()}`,
  content: {
    entryType: 'TimelineTimelineItem',
    itemContent: { itemType: 'TimelineTweet', tweet_results: { result } },
  },
});

// Same nesting as a real `Bookmarks` response.
const response = (entries: object[], bottom = 'NEXT') => ({
  data: {
    bookmark_timeline_v2: {
      timeline: {
        instructions: [
          {
            type: 'TimelineAddEntries',
            entries: [
              ...entries,
              { entryId: 'cursor-top-1', content: { cursorType: 'Top', value: 'TOP' } },
              { entryId: 'cursor-bottom-1', content: { cursorType: 'Bottom', value: bottom } },
            ],
          },
        ],
      },
    },
  },
});

describe('X bookmarks', () => {
  it('reads a tweet, hiding the trailing media link and decoding entities', () => {
    const page = parsePage(response([entry(tweet('1'))]));
    expect(page.continuation).toBe('NEXT');
    expect(page.items).toEqual([
      {
        id: '1',
        handle: '1',
        author: 'Name alice @alice',
        title: '',
        text: 'Hello & welcome 👋',
        info: expect.any(String),
        url: 'https://x.com/alice/status/1',
        media: [],
      },
    ]);
  });

  it('picks photos and the highest-bitrate mp4', () => {
    const media = [
      { type: 'photo', media_url_https: 'https://pbs.twimg.com/a.jpg' },
      {
        type: 'video',
        media_url_https: 'https://pbs.twimg.com/thumb.jpg',
        video_info: {
          variants: [
            { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/v.m3u8' },
            { content_type: 'video/mp4', bitrate: 632000, url: 'https://video.twimg.com/low.mp4' },
            { content_type: 'video/mp4', bitrate: 2176000, url: 'https://video.twimg.com/hi.mp4' },
          ],
        },
      },
    ];
    const t = tweet('2');
    const page = parsePage(
      response([entry({ ...t, legacy: { ...t.legacy, extended_entities: { media } } })]),
    );
    expect(page.items[0].media).toEqual([
      { kind: 'image', url: 'https://pbs.twimg.com/a.jpg?name=large' },
      {
        kind: 'video',
        url: 'https://video.twimg.com/hi.mp4',
        poster: 'https://pbs.twimg.com/thumb.jpg',
      },
    ]);
  });

  it('prefers long-post text, unwraps visibility results and shows the quoted post', () => {
    const quoted = tweet('9', { core: user('bob') });
    const long = tweet('3', {
      note_tweet: { note_tweet_results: { result: { text: 'The whole long post' } } },
      quoted_status_result: { result: quoted },
    });
    const page = parsePage(
      response([entry({ __typename: 'TweetWithVisibilityResults', tweet: long })]),
    );
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: '3',
      text: 'The whole long post\n\n↪ @bob: Hello & welcome 👋',
    });
  });

  it('ends the list on a page without tweets despite the cursor', () => {
    expect(parsePage(response([]))).toEqual({ items: [], continuation: null });
  });
});
