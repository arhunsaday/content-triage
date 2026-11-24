// x-client-transaction-id imports linkedom only for fetchXDocument, a Node helper Content Triage
// never calls: the page has a real DOMParser. Aliasing linkedom here keeps ~370 kB of DOM
// emulation out of the script injected into x.com.
export function parseHTML(): never {
  throw new Error('linkedom is not bundled in Content Triage.');
}
