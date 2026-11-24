<div align="center">
  <img src="brand/logo.svg" width="72" height="72" alt="">
  <h1>Triage</h1>
  <p><strong>Clear what you saved for later by swiping.</strong><br>
  YouTube Watch Later, X bookmarks and Instagram saved posts. No account, no backend, no tracking.</p>
</div>

---

Triage turns a saved-for-later list into a card stack. Each card shows the post itself:
photos, carousels and videos play right on the card (muted until you click), and YouTube
videos play in the embedded player. Decide, and the next one slides in.

| Gesture     | Key       | Effect                                     |
| ----------- | --------- | ------------------------------------------ |
| Swipe left  | `←`       | Remove from the list                       |
| Swipe right | `→`       | Keep it and move on                        |
| Swipe up    | `↑`       | Open it in a new tab, keep it              |
| Undo button | `Z` / `⌫` | Undo the last decision                     |
| Close       | `Esc`     | Close; the list page reloads if it changed |

Open it from the toolbar popup, or the **Triage** button on each site's list page.

| Source      | List page                      |
| ----------- | ------------------------------ |
| Watch Later | `youtube.com/playlist?list=WL` |
| Bookmarks   | `x.com/i/history`              |
| Saved       | `instagram.com/<you>/saved/`   |

## Install

Download the latest build from [`releases/`](releases/), then follow
[docs/distribution.md](docs/distribution.md):

- **Firefox 142+**: drag the signed `.xpi` onto a Firefox window.
- **Chrome, Edge, Brave, Arc**: unzip, then _Load unpacked_ in `chrome://extensions`.

From source: `pnpm install && pnpm build:all`, then load `dist/` unpacked in Chrome or
`dist-firefox/manifest.json` from `about:debugging#/runtime/this-firefox` in Firefox. After a
rebuild, reload the extension, then reload the site's tab.

## How it works

Each site gets a page-world script that calls the same endpoints the site uses for its own
remove, unbookmark or unsave button, with your existing session: YouTube's InnerTube
`browse/edit_playlist`, X's GraphQL `Bookmarks` / `DeleteBookmark` / `CreateBookmark`
(operation ids read from X's loaded web app, since they change with every deploy), and
Instagram's `feed/saved` and `web/save` API. Writes run one at a time, in order, so an undo
always lands after the removal it reverses.

Undo on YouTube puts the video back in its old place. X and Instagram cannot reorder, so an
undone item comes back as your newest bookmark or save.

The extension requests no permissions beyond running on these three sites.

## Development

```sh
pnpm dev        # Vite + CRXJS with hot reload, load dist/ unpacked
pnpm verify     # format, typecheck, tests, Chrome + Firefox builds
pnpm lint:firefox
pnpm brand      # regenerate icons and brand/logo.svg
pnpm ship patch # bump, verify, sign the Firefox XPI, refresh releases/
```

| Path                    | Role                                                |
| ----------------------- | --------------------------------------------------- |
| `src/shared/sources.ts` | The three sources: names, hosts, list pages         |
| `src/sources/<site>/`   | Page world per site: API calls and response parsing |
| `src/page/serve.ts`     | Page-world request loop and navigation events       |
| `src/content/bridge.ts` | Typed, validated requests to the page world         |
| `src/content/triage/`   | Card stack, media viewer, decisions and undo queue  |
| `src/popup/`            | Toolbar popup                                       |
