/**
 * Minimal atproto-identity worker for claude.jason-edelman.org.
 *
 * Two jobs only, matching scout-harness's proven shape at reduced scope:
 * 1. Serve /.well-known/atproto-did so this domain can be used as a custom
 *    atproto handle (env.CLAUDE_DID, set once the account/DID exists).
 * 2. Forward inbound mail (Email Routing) to a real inbox so PDS signup /
 *    verification isn't blocked on standing up a real mailbox. No parsing,
 *    no reply logic, no agent loop - just relay.
 *
 * Plain JS, deliberately: this worker shares no code with the written-world
 * engine, so there's no reason to carry a Rust/wasm build step just for two
 * small handlers. No build step at all - wrangler deploys this directly.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response("ok");
    }
    if (url.pathname === "/.well-known/atproto-did") {
      return new Response(env.CLAUDE_DID, {
        headers: { "content-type": "text/plain" },
      });
    }
    return new Response(
      "claude-identity has no HTTP surface beyond /health and /.well-known/atproto-did - it runs on Email Routing for inbound mail.",
      { status: 404 },
    );
  },

  async email(message, env) {
    await message.forward(env.FORWARD_TO);
  },
};
