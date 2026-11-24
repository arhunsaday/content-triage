// Runs in X's own JavaScript world. X's GraphQL operation ids change with every
// deploy, so they are read from the web app's loaded modules instead of being
// hardcoded, and requests carry the same headers x.com sends for its own calls.
import { ClientTransaction } from 'x-client-transaction-id';
import { cookie, serve } from '@/page/serve';
import { parsePage } from './parse';

declare const webpackChunk_twitter_responsive_web: [unknown, Record<string, unknown>][];

type Operation = { id: string; features: string[]; toggles: string[] };
type Client = { bearer: string; operations: Map<string, Operation> };

const NAMES = ['Bookmarks', 'DeleteBookmark', 'CreateBookmark'];
const names = (list: string) => list.match(/\w+/g) ?? [];
const enabled = (list: string[]) => JSON.stringify(Object.fromEntries(list.map((n) => [n, true])));

let client: Client | null = null;
function discover(): Client {
  if (client) return client;
  let bearer: string | undefined;
  const operations = new Map<string, Operation>();
  for (const [, modules] of webpackChunk_twitter_responsive_web)
    for (const factory of Object.values(modules)) {
      const source = String(factory);
      bearer ??= source.match(/"(AAAAAAAAAAAAAAAAAAAAA[\w%]+)"/)?.[1];
      for (const m of source.matchAll(
        /queryId:"([\w-]+)",operationName:"(\w+)",operationType:"\w+",metadata:\{featureSwitches:\[([^\]]*)\],fieldToggles:\[([^\]]*)\]/g,
      ))
        if (NAMES.includes(m[2]))
          operations.set(m[2], {
            id: m[1],
            features: names(m[3]),
            toggles: names(m[4]),
          });
    }
  if (!bearer || operations.size < NAMES.length)
    throw new Error('X changed how its web app loads. Reload the page and try again.');
  client = { bearer: decodeURIComponent(bearer), operations };
  return client;
}

// X rejects writes without an x-client-transaction-id. Its inputs live in a freshly
// served page: the loaded app has already removed the animation they are derived from.
let transaction: Promise<ClientTransaction> | null = null;
function transactionId(path: string) {
  transaction ??= fetch('/home', { credentials: 'include' })
    .then((response) => response.text())
    .then((html) => ClientTransaction.create(new DOMParser().parseFromString(html, 'text/html')))
    .catch((error) => {
      transaction = null;
      throw error;
    });
  return transaction.then((t) => t.generateTransactionId('POST', path));
}

async function graphql(name: string, variables: object) {
  const { bearer, operations } = discover();
  const op = operations.get(name)!;
  const csrf = cookie('ct0');
  if (!csrf) throw new Error('Sign in to X to triage your bookmarks.');
  const headers = {
    authorization: `Bearer ${bearer}`,
    'content-type': 'application/json',
    'x-csrf-token': csrf,
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
  };
  const response =
    name === 'Bookmarks'
      ? await fetch(
          `/i/api/graphql/${op.id}/${name}?${new URLSearchParams({
            variables: JSON.stringify(variables),
            features: enabled(op.features),
            fieldToggles: enabled(op.toggles),
          })}`,
          { credentials: 'include', headers },
        )
      : await fetch(`/i/api/graphql/${op.id}/${name}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...headers,
            'x-client-transaction-id': await transactionId(`/i/api/graphql/${op.id}/${name}`),
          },
          body: JSON.stringify({ variables, queryId: op.id }),
        });
  if (!response.ok) throw new Error(`X answered ${response.status}.`);
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors[0].message);
  return result;
}

serve({
  list: async (cursor) =>
    parsePage(
      await graphql('Bookmarks', {
        count: 50,
        includePromotedContent: false,
        ...(cursor && { cursor }),
      }),
    ),
  remove: async (id) => {
    await graphql('DeleteBookmark', { tweet_id: id });
  },
  restore: async (id) => {
    await graphql('CreateBookmark', { tweet_id: id });
    return id;
  },
});
