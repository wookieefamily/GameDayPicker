// Netlify Functions v2 (ESM) — required for @netlify/blobs to work reliably
import { getStore } from "@netlify/blobs";

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const store = getStore("polls");
    const url   = new URL(req.url);

    // GET /api/polls?slug=foo
    // GET /api/polls?debug=1  → confirms function + Blobs are reachable
    if (req.method === "GET") {
      if (url.searchParams.get("debug") === "1") {
        await store.set("__ping", "ok");
        const ping = await store.get("__ping");
        return new Response(JSON.stringify({ ok: true, ping }), { status: 200, headers });
      }

      const slug = (url.searchParams.get("slug") ?? "").replace(/[^a-z0-9_-]/g, "");
      if (!slug) {
        return new Response(JSON.stringify({ error: "slug is required" }), { status: 400, headers });
      }
      const data = await store.get(slug, { type: "json" });
      if (!data) {
        return new Response(JSON.stringify({ error: "Poll not found" }), { status: 404, headers });
      }
      return new Response(JSON.stringify(data), { status: 200, headers });
    }

    // POST /api/polls  — create poll, returns { slug }
    if (req.method === "POST") {
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
      }

      const { title, description, options } = body;
      if (!title || !Array.isArray(options) || options.length < 2) {
        return new Response(
          JSON.stringify({ error: "title and at least 2 options are required" }),
          { status: 400, headers }
        );
      }

      let slug = slugify(title) || "poll";

      // Ensure uniqueness
      let attempt = slug;
      let counter = 2;
      while (await store.get(attempt)) {
        attempt = `${slug}-${counter++}`;
      }
      slug = attempt;

      const config = {
        slug,
        title: title.trim(),
        description: (description ?? "").trim(),
        options,
        createdAt: Date.now(),
      };

      await store.setJSON(slug, config);
      return new Response(JSON.stringify({ slug }), { status: 201, headers });
    }

    return new Response("Method not allowed", { status: 405, headers });

  } catch (err) {
    // Surface the real error instead of a silent 502
    console.error("polls function error:", err);
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 500, headers }
    );
  }
};

// v2 routing — replaces the netlify.toml redirect for /api/polls
export const config = { path: "/api/polls" };
