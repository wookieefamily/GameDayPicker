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

// Use consistency: "strong" so writes are immediately visible in subsequent reads
function getPolls() {
  return getStore({ name: "polls", consistency: "strong" });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const store = getPolls();
    const url   = new URL(req.url);

    // GET /api/polls?debug=1  → list all stored poll slugs
    if (req.method === "GET" && url.searchParams.get("debug") === "1") {
      const { blobs } = await store.list();
      const keys = blobs.map(b => b.key);
      return new Response(JSON.stringify({ ok: true, keys }), { status: 200, headers });
    }

    // GET /api/polls?slug=foo
    if (req.method === "GET") {
      const rawSlug = url.searchParams.get("slug") ?? "";
      const slug = rawSlug.replace(/[^a-z0-9_-]/g, "");
      console.log("GET slug:", slug);
      if (!slug) {
        return new Response(JSON.stringify({ error: "slug is required" }), { status: 400, headers });
      }
      // Use raw get + manual JSON.parse to avoid any typed-cache quirks
      const raw = await store.get(slug);
      console.log("GET raw result:", raw ? "found" : "null");
      if (!raw) {
        return new Response(JSON.stringify({ error: "Poll not found" }), { status: 404, headers });
      }
      return new Response(raw, { status: 200, headers });
    }

    // POST /api/polls  — create poll, returns { slug }
    if (req.method === "POST") {
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
      }

      const { title, description, options, league } = body;
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
        league: league ?? null,
        createdAt: Date.now(),
      };

      // Store as raw JSON string to avoid any typed-metadata issues on read
      await store.set(slug, JSON.stringify(config));
      console.log("POST stored slug:", slug);

      // Verify write is readable
      const verify = await store.get(slug);
      console.log("POST verify:", verify ? "ok" : "MISSING");

      return new Response(JSON.stringify({ slug }), { status: 201, headers });
    }

    return new Response("Method not allowed", { status: 405, headers });

  } catch (err) {
    console.error("polls function error:", err);
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 500, headers }
    );
  }
};

export const config = { path: "/api/polls" };
