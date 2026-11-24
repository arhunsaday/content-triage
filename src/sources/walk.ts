export type Json = Record<string, unknown>;

/** Visits every object in a JSON tree, depth first. */
export function walk(node: unknown, visit: (node: Json) => void) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  visit(node as Json);
  for (const child of Object.values(node)) walk(child, visit);
}
