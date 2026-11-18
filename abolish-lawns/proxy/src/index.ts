const UPSTREAM = "https://abolish-lawns.pages.dev";
const BASE = "/abolish-lawns";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Strip the /abolish-lawns prefix before forwarding upstream
    // e.g. jason-edelman.org/abolish-lawns/foo → abolish-lawns.pages.dev/foo
    const upstreamPath = url.pathname.slice(BASE.length) || "/";
    const upstreamUrl = `${UPSTREAM}${upstreamPath}${url.search}`;

    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "follow",
    });

    const response = await fetch(upstreamRequest);

    // Rewrite any absolute URLs in redirects that point to the upstream domain
    // back to jason-edelman.org/abolish-lawns so they stay on the right domain
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location?.startsWith(UPSTREAM)) {
        const headers = new Headers(response.headers);
        headers.set(
          "location",
          BASE + location.slice(UPSTREAM.length)
        );
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
    }

    return response;
  },
};
