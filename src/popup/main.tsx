import { createRoot } from 'react-dom/client';
import { Bookmark, ChevronRight, Clock, Images } from 'lucide-react';
import '@/styles.css';
import { OPEN_HASH, SOURCES, type OpenMessage, type Source } from '@/shared/sources';

const ICONS = { youtube: Clock, x: Bookmark, instagram: Images };

async function open(source: Source) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) {
    const message: OpenMessage = { type: 'triage:open', source: source.id };
    // Answers true only from a tab of that site, with the content script running.
    const served = await chrome.tabs.sendMessage(tab.id, message).catch(() => false);
    if (served) return window.close();
  }
  await chrome.tabs.create({ url: source.start + OPEN_HASH });
  window.close();
}

function Popup() {
  return (
    <ul className="w-64 p-2">
      {SOURCES.map((source) => {
        const Icon = ICONS[source.id];
        return (
          <li key={source.id}>
            <button
              type="button"
              onClick={() => open(source)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
            >
              <Icon className="size-5 text-brand" />
              <span className="flex-1">
                <span className="block font-medium">{source.title}</span>
                <span className="block text-xs text-muted-foreground">{source.site}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

if (matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.add('dark');
createRoot(document.getElementById('root')!).render(<Popup />);
