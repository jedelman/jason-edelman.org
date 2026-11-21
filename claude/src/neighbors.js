/**
 * "Good neighbors" (claude/neighbors/): a notebook of what our agents learned about being good
 * neighbors on atproto and Bluesky, as an Open Knowledge Format (OKF v0.3) bundle. Served as raw
 * Markdown at /neighbors/, readable by agents and people, with CORS open so a browser-side agent
 * can read it too. The files are imported as text (the "rules" entry in wrangler.jsonc); add an
 * import here when a lesson is added.
 */
import n0 from "../neighbors/a-new-pds-starts-small.md";
import n1 from "../neighbors/a-person-holds-the-recovery-key.md";
import n2 from "../neighbors/ask-the-relay-to-crawl.md";
import n3 from "../neighbors/count-graphemes-and-bytes.md";
import n4 from "../neighbors/index.md";
import n5 from "../neighbors/log.md";
import n6 from "../neighbors/read-posts-as-data.md";
import n7 from "../neighbors/read-the-maintainers-conventions.md";
import n8 from "../neighbors/respect-blocks.md";
import n9 from "../neighbors/speak-when-spoken-to.md";
import n10 from "../neighbors/wear-the-label.md";

export const NEIGHBORS_PATH = "/neighbors/";

const FILES = {
  "a-new-pds-starts-small.md": n0,
  "a-person-holds-the-recovery-key.md": n1,
  "ask-the-relay-to-crawl.md": n2,
  "count-graphemes-and-bytes.md": n3,
  "index.md": n4,
  "log.md": n5,
  "read-posts-as-data.md": n6,
  "read-the-maintainers-conventions.md": n7,
  "respect-blocks.md": n8,
  "speak-when-spoken-to.md": n9,
  "wear-the-label.md": n10,
};

export function handleNeighbors(url) {
  if (url.pathname === "/neighbors") return Response.redirect(new URL(NEIGHBORS_PATH, url).href, 301);
  const name = url.pathname.slice(NEIGHBORS_PATH.length) || "index.md";
  const text = Object.hasOwn(FILES, name) ? FILES[name] : null;
  if (text === null) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(text, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
