export type SourceId = 'youtube' | 'x' | 'instagram';

export type Source = {
  id: SourceId;
  /** The list being triaged, as the site names it. */
  title: string;
  site: string;
  host: string;
  /** Where the toolbar popup opens a new tab. */
  start: string;
  /** The page that renders the list; it shows the launcher and reloads after changes. */
  isList(location: Location): boolean;
};

export const SOURCES: Source[] = [
  {
    id: 'youtube',
    title: 'Watch Later',
    site: 'YouTube',
    host: 'www.youtube.com',
    start: 'https://www.youtube.com/playlist?list=WL',
    isList: (l) => l.pathname === '/playlist' && new URLSearchParams(l.search).get('list') === 'WL',
  },
  {
    id: 'x',
    title: 'Bookmarks',
    site: 'X',
    host: 'x.com',
    start: 'https://x.com/i/history',
    isList: (l) => l.pathname === '/i/history' || l.pathname === '/i/bookmarks',
  },
  {
    id: 'instagram',
    title: 'Saved',
    site: 'Instagram',
    host: 'www.instagram.com',
    start: 'https://www.instagram.com/',
    isList: (l) => /^\/[^/]+\/saved\//.test(l.pathname),
  },
];

/** Sent by the toolbar popup; the content script answers true when it serves `source`. */
export type OpenMessage = { type: 'triage:open'; source: SourceId };
/** Opens triage on load, for tabs the popup creates. */
export const OPEN_HASH = '#triage';
