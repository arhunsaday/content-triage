import { useCallback, useEffect, useRef, useState } from 'react';
import type { Item } from '@/shared/protocol';
import type { Site } from '../bridge';
import { initialState, reducer, type Action, type Verdict } from './state';

/** Load the next page once fewer than this many cards are left. */
const PREFETCH = 15;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const label = (item: Item) => (item.title || item.text || item.author).slice(0, 60);

export function useTriage(site: Site) {
  // Decisions read the latest state synchronously, so two quick swipes can
  // never act on the same card.
  const store = useRef(initialState);
  const [state, setState] = useState(initialState);
  const dispatch = useCallback((action: Action) => {
    store.current = reducer(store.current, action);
    setState(store.current);
  }, []);

  // Writes run one at a time, in the order they were made, so an undo always
  // lands after the removal it reverses.
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  const serial = useCallback(<T>(task: () => Promise<T>) => {
    const run = tail.current.then(task);
    tail.current = run.catch(() => {});
    return run;
  }, []);
  const removals = useRef(new Map<number, Promise<boolean>>());
  // A re-added YouTube video gets a new playlist entry id.
  const reissued = useRef(new Map<number, string>());
  const handle = (index: number) =>
    reissued.current.get(index) ?? store.current.items[index].handle;

  const load = useCallback(
    async (continuation: string | null) => {
      dispatch({ type: 'loading' });
      try {
        dispatch({ type: 'loaded', page: await site.list(continuation) });
      } catch (error) {
        dispatch({ type: 'error', error: message(error) });
      }
    },
    [dispatch, site],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const { loaded, loading, error, continuation, items, cursor } = state;
  useEffect(() => {
    if (loaded && !loading && !error && continuation && items.length - cursor < PREFETCH)
      void load(continuation);
  }, [loaded, loading, error, continuation, items.length, cursor, load]);

  const decide = (verdict: Verdict) => {
    const index = store.current.cursor;
    const item = store.current.items[index];
    if (!item) return;
    dispatch({ type: 'decide', verdict });
    if (verdict === 'open') window.open(item.url, '_blank', 'noopener');
    if (verdict === 'remove')
      removals.current.set(
        index,
        serial(() => site.remove(handle(index))).then(
          () => true,
          (e) => {
            dispatch({
              type: 'failed',
              index,
              error: `Couldn't remove “${label(item)}”: ${message(e)}`,
            });
            return false;
          },
        ),
      );
  };

  const undo = () => {
    const last = store.current.history.at(-1);
    if (!last) return;
    dispatch({ type: 'undo' });
    if (last.verdict !== 'remove') return;
    const removed = removals.current.get(last.index);
    removals.current.delete(last.index);
    const item = store.current.items[last.index];
    serial(async () => {
      if (!(await removed)) return;
      // Undo is last-in-first-out, so the next item is back in the list by now.
      const successor = store.current.items[last.index + 1] ? handle(last.index + 1) : null;
      reissued.current.set(last.index, await site.restore(item.id, successor));
    }).catch((e) =>
      dispatch({ type: 'error', error: `Couldn't put back “${label(item)}”: ${message(e)}` }),
    );
  };

  /** Resolves once every queued change has reached the site. */
  const settled = () => tail.current;

  return { state, decide, undo, settled };
}
