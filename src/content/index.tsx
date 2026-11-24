import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NAVIGATE_EVENT } from '@/shared/protocol';
import { OPEN_HASH, SOURCES, type OpenMessage } from '@/shared/sources';
import { site } from './bridge';
import { mount } from './mount';
import { Triage } from './triage/triage';

const source = SOURCES.find((s) => s.host === location.host)!;

/** Follows the site's own theme, whatever mechanism it uses to switch it. */
function isDark() {
  for (const element of [document.body, document.documentElement]) {
    const rgb = getComputedStyle(element)
      .backgroundColor.match(/[\d.]+/g)
      ?.map(Number);
    if (rgb && rgb[3] !== 0) return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] < 128;
  }
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

function App() {
  const [open, setOpen] = useState(() => location.hash === OPEN_HASH);
  const [onList, setOnList] = useState(() => source.isList(location));
  const [dark, setDark] = useState(isDark);

  useEffect(() => {
    if (location.hash === OPEN_HASH)
      history.replaceState(history.state, '', location.href.split('#')[0]);
    const onMessage = (message: OpenMessage, _: unknown, reply: (served: boolean) => void) => {
      if (message.type !== 'triage:open' || message.source !== source.id) return;
      setOpen(true);
      reply(true);
    };
    const onNavigate = () => setOnList(source.isList(location));
    chrome.runtime.onMessage.addListener(onMessage);
    document.addEventListener(NAVIGATE_EVENT, onNavigate);
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      document.removeEventListener(NAVIGATE_EVENT, onNavigate);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setDark(isDark());
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = overflow;
    };
  }, [open]);

  const close = (changed: boolean) => {
    setOpen(false);
    // The list the site rendered underneath still shows the removed items.
    if (changed && source.isList(location)) location.reload();
  };

  return (
    <div className={dark ? 'dark' : undefined}>
      {open ? (
        <Triage source={source} site={site} onClose={close} />
      ) : (
        onList && (
          <Button
            onClick={() => setOpen(true)}
            className="pointer-events-auto fixed right-6 bottom-6 h-12 rounded-full bg-brand px-5 text-base text-white shadow-lg hover:bg-brand/90"
          >
            <Layers className="size-5" />
            Triage
          </Button>
        )
      )}
    </div>
  );
}

mount(<App />);
