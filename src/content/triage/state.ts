import type { Page, Item } from '@/shared/protocol';

export type Verdict = 'remove' | 'keep' | 'open';
export type Decision = { index: number; verdict: Verdict; failed: boolean };

export type State = {
  items: Item[];
  continuation: string | null;
  /** Index of the item on top of the stack. */
  cursor: number;
  history: Decision[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
};

export type Action =
  | { type: 'loading' }
  | { type: 'loaded'; page: Page }
  | { type: 'decide'; verdict: Verdict }
  | { type: 'undo' }
  | { type: 'failed'; index: number; error: string }
  | { type: 'error'; error: string };

export const initialState: State = {
  items: [],
  continuation: null,
  cursor: 0,
  history: [],
  loaded: false,
  loading: false,
  error: null,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true, error: null };
    case 'loaded':
      return {
        ...state,
        items: [...state.items, ...action.page.items],
        continuation: action.page.continuation,
        loaded: true,
        loading: false,
      };
    case 'decide':
      if (state.cursor >= state.items.length) return state;
      return {
        ...state,
        cursor: state.cursor + 1,
        history: [
          ...state.history,
          { index: state.cursor, verdict: action.verdict, failed: false },
        ],
        error: null,
      };
    case 'undo': {
      const last = state.history.at(-1);
      if (!last) return state;
      return { ...state, cursor: last.index, history: state.history.slice(0, -1), error: null };
    }
    case 'failed':
      return {
        ...state,
        history: state.history.map((d) => (d.index === action.index ? { ...d, failed: true } : d)),
        error: action.error,
      };
    case 'error':
      return { ...state, loading: false, error: action.error };
  }
}

export function summary(state: State) {
  const counted = state.history.filter((d) => !d.failed);
  return {
    removed: counted.filter((d) => d.verdict === 'remove').length,
    kept: counted.filter((d) => d.verdict !== 'remove').length,
    current: state.items[state.cursor] as Item | undefined,
    finished:
      state.loaded && !state.loading && !state.continuation && state.cursor >= state.items.length,
    total: state.items.length,
    more: state.continuation !== null,
  };
}
