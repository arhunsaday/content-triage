import { describe, expect, it } from 'vitest';
import { addedSetVideoId, parsePage } from '@/sources/youtube/parse';

const item = (videoId: string, setVideoId: string, extra: object = {}) => ({
  playlistVideoRenderer: {
    videoId,
    setVideoId,
    title: { runs: [{ text: `Title ${videoId}` }] },
    shortBylineText: { runs: [{ text: 'Channel' }] },
    videoInfo: { runs: [{ text: '2.8M views' }, { text: ' • ' }, { text: '1 month ago' }] },
    lengthText: { simpleText: '12:34' },
    thumbnail: {
      thumbnails: [
        { url: 'https://i.ytimg.com/small.jpg' },
        { url: 'https://i.ytimg.com/large.jpg' },
      ],
    },
    ...extra,
  },
});

// Same nesting as a real `browse` response for VLWL.
const firstPage = {
  contents: {
    twoColumnBrowseResultsRenderer: {
      tabs: [
        {
          tabRenderer: {
            content: {
              sectionListRenderer: {
                contents: [
                  {
                    itemSectionRenderer: {
                      contents: [
                        {
                          playlistVideoListRenderer: {
                            contents: [
                              item('a', 'SA', {
                                thumbnailOverlays: [
                                  {
                                    thumbnailOverlayResumePlaybackRenderer: {
                                      percentDurationWatched: 42,
                                    },
                                  },
                                ],
                              }),
                              item('b', 'SB', { lengthText: undefined, thumbnail: undefined }),
                              {
                                continuationItemRenderer: {
                                  continuationEndpoint: { continuationCommand: { token: 'NEXT' } },
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    },
  },
};

describe('parsePage', () => {
  it('reads videos and the continuation token', () => {
    const page = parsePage(firstPage);
    expect(page.continuation).toBe('NEXT');
    expect(page.items).toEqual([
      {
        id: 'a',
        handle: 'SA',
        author: 'Channel',
        title: 'Title a',
        text: '',
        info: '2.8M views • 1 month ago',
        url: 'https://www.youtube.com/watch?v=a',
        media: [
          {
            kind: 'youtube',
            videoId: 'a',
            poster: 'https://i.ytimg.com/large.jpg',
            duration: '12:34',
            progress: 42,
          },
        ],
      },
      expect.objectContaining({
        id: 'b',
        media: [
          {
            kind: 'youtube',
            videoId: 'b',
            poster: 'https://i.ytimg.com/vi/b/hqdefault.jpg',
            duration: null,
            progress: 0,
          },
        ],
      }),
    ]);
  });

  it('reads continuation pages and the last page', () => {
    const last = {
      onResponseReceivedActions: [
        { appendContinuationItemsAction: { continuationItems: [item('c', 'SC')] } },
      ],
    };
    expect(parsePage(last)).toEqual({
      items: [expect.objectContaining({ id: 'c', handle: 'SC' })],
      continuation: null,
    });
  });

  it('skips entries that cannot be edited', () => {
    expect(parsePage({ playlistVideoRenderer: { videoId: 'x' } }).items).toEqual([]);
  });
});

describe('addedSetVideoId', () => {
  it('returns the id YouTube assigned to the re-added video', () => {
    const response = {
      status: 'STATUS_SUCCEEDED',
      playlistEditResults: [
        { playlistEditVideoAddedResultData: { videoId: 'a', setVideoId: 'NEW' } },
      ],
    };
    expect(addedSetVideoId(response)).toBe('NEW');
  });

  it('fails loudly when YouTube does not confirm', () => {
    expect(() => addedSetVideoId({ status: 'STATUS_SUCCEEDED' })).toThrow();
  });
});
