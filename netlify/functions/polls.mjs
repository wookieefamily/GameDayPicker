// Netlify Functions v2 (ESM) — required for @netlify/blobs to work reliably
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

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

    // GET /api/polls?slug=foo
    if (req.method === "GET") {
      const rawSlug = url.searchParams.get("slug") ?? "";
      const slug = rawSlug.replace(/[^a-z0-9_-]/g, "");
      if (!slug) {
        return new Response(JSON.stringify({ error: "slug is required" }), { status: 400, headers });
      }
      const raw = await store.get(slug);
      if (!raw) {
        return new Response(JSON.stringify({ error: "Poll not found" }), { status: 404, headers });
      }
      // Strip adminToken — never expose it to the client
      const { adminToken: _hidden, ...publicPoll } = JSON.parse(raw);
      return new Response(JSON.stringify(publicPoll), { status: 200, headers });
    }

    // POST /api/polls  — create poll, returns { slug }
    if (req.method === "POST") {
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
      }

      const { title, description, options, league, teamName, teamAbbrev, deadline } = body;
      if (!title || !Array.isArray(options) || options.length < 2) {
        return new Response(
          JSON.stringify({ error: "title and at least 2 options are required" }),
          { status: 400, headers }
        );
      }

      const adminToken = randomUUID();
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
        teamName: teamName ?? null,
        teamAbbrev: teamAbbrev ?? null,
        deadline: deadline ?? null,
        adminToken,
        createdAt: Date.now(),
      };

      // Store as raw JSON string to avoid any typed-metadata issues on read
      await store.set(slug, JSON.stringify(config));
      console.log("POST stored slug:", slug);

      // Verify write is readable
      const verify = await store.get(slug);
      console.log("POST verify:", verify ? "ok" : "MISSING");

      // Notify via Resend email
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        try {
          const adminLink = `https://gamedaypicker.com/poll/${slug}/admin?token=${adminToken}`;
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Game Day Picker <info@gamedaypicker.com>",
              to: "info@gamedaypicker.com",
              subject: "New Poll",
              text: `New poll created: "${title.trim()}"\n\nAdmin link: ${adminLink}`,
            }),
          });
          const resendBody = await r.text();
          console.log("Resend status:", r.status, resendBody);
        } catch (e) {
          console.error("Resend notify failed:", e);
        }
      }

      return new Response(JSON.stringify({ slug, adminToken }), { status: 201, headers });
    }

    // PATCH /api/polls?slug=foo  — update fields (e.g. winner), requires adminToken in body
    if (req.method === "PATCH") {
      const rawSlug = url.searchParams.get("slug") ?? "";
      const slug = rawSlug.replace(/[^a-z0-9_-]/g, "");
      if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400, headers });
      const raw = await store.get(slug);
      if (!raw) return new Response(JSON.stringify({ error: "Poll not found" }), { status: 404, headers });
      let body;
      try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers }); }
      const stored = JSON.parse(raw);
      // Validate adminToken if poll has one
      if (stored.adminToken && body.adminToken !== stored.adminToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers });
      }
      // Only allow updating safe fields — never overwrite adminToken or core identity
      const { adminToken: _t, slug: _s, createdAt: _c, ...allowedUpdates } = body;
      const updated = { ...stored, ...allowedUpdates };
      await store.set(slug, JSON.stringify(updated));
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
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
