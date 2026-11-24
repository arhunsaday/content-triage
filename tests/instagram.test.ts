import { describe, expect, it } from 'vitest';
import { parsePage, relayDocIds, shortcode } from '@/sources/instagram/parse';

const image = (url: string) => ({ candidates: [{ url, width: 1080, height: 1350 }] });

const reel = {
  id: '3996091713822898752_262481811',
  media_type: 2,
  product_type: 'clips',
  code: 'Dd0',
  taken_at: 1790591314,
  user: { username: 'someone' },
  caption: { text: 'now we can talk' },
  image_versions2: image('https://scontent.cdninstagram.com/poster.jpg'),
  video_versions: [{ url: 'https://scontent.cdninstagram.com/reel.mp4', width: 720, height: 1280 }],
};

const carousel = {
  id: '111_222',
  media_type: 8,
  product_type: 'carousel_container',
  code: 'Car',
  taken_at: 1790591314,
  user: { username: 'other' },
  caption: null,
  carousel_media: [
    { id: 'c1', media_type: 1, image_versions2: image('https://scontent.cdninstagram.com/1.jpg') },
    {
      id: 'c2',
      media_type: 2,
      image_versions2: image('https://scontent.cdninstagram.com/2.jpg'),
      video_versions: [{ url: 'https://scontent.cdninstagram.com/2.mp4', width: 1, height: 1 }],
    },
  ],
};

describe('Instagram saved', () => {
  it('reads a reel with its video, using the exact media id', () => {
    const page = parsePage({
      items: [{ media: reel }],
      more_available: true,
      next_max_id: 'MAX',
      status: 'ok',
    });
    expect(page).toEqual({
      items: [
        {
          id: '3996091713822898752',
          handle: '3996091713822898752',
          author: 'someone',
          title: '',
          text: 'now we can talk',
          info: expect.any(String),
          url: 'https://www.instagram.com/reel/Dd0/',
          media: [
            {
              kind: 'video',
              url: 'https://scontent.cdninstagram.com/reel.mp4',
              poster: 'https://scontent.cdninstagram.com/poster.jpg',
            },
          ],
        },
      ],
      continuation: 'MAX',
    });
  });

  it('flattens a carousel and stops on the last page', () => {
    const page = parsePage({ items: [{ media: carousel }], more_available: false, status: 'ok' });
    expect(page.continuation).toBeNull();
    expect(page.items[0]).toMatchObject({
      id: '111',
      text: '',
      url: 'https://www.instagram.com/p/Car/',
      media: [
        { kind: 'image', url: 'https://scontent.cdninstagram.com/1.jpg' },
        { kind: 'video', url: 'https://scontent.cdninstagram.com/2.mp4' },
      ],
    });
  });
});

describe('Instagram mutations', () => {
  it('turns a media id into the shortcode of its post URL', () => {
    // A real post: instagram.com/p/Df75lxnmIrF/
    expect(shortcode('4034071175789841093')).toBe('Df75lxnmIrF');
  });

  it('reads the save and unsave doc ids from a script, ignoring collection mutations', () => {
    const script = [
      '__d("usePolarisMediaSaveToCollectionAddMediaMutation_instagramRelayOperation",[],(function(a,b,c,d,e,f){e.exports="1"}),null);',
      '__d("usePolarisSaveMediaSaveMutation_instagramRelayOperation",[],(function(a,b,c,d,e,f){e.exports="27365486596441074"}),null);',
      '__d("usePolarisSaveMediaUnsaveMutation_instagramRelayOperation",[],(function(a,b,c,d,e,f){e.exports="27371251859134880"}),null);',
    ].join('\n');
    expect(relayDocIds(script)).toEqual({ Save: '27365486596441074', Unsave: '27371251859134880' });
    expect(relayDocIds('nothing here')).toEqual({});
  });
});
