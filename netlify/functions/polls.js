const { getStore } = require("@netlify/blobs");

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  const store = getStore("polls");

  // GET /api/polls?slug=foo  — fetch a single poll config
  if (event.httpMethod === "GET") {
    const slug = (event.queryStringParameters?.slug || "").replace(/[^a-z0-9_-]/g, "");
    if (!slug) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "slug is required" }) };
    }
    const data = await store.get(slug, { type: "json" });
    if (!data) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Poll not found" }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  // POST /api/polls  — create a new poll, returns { slug }
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    const { title, description, options } = body;
    if (!title || !Array.isArray(options) || options.length < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "title and at least 2 options are required" }) };
    }

    let slug = slugify(title);
    if (!slug) slug = "poll";

    // Ensure slug uniqueness — append counter if taken
    let attempt = slug;
    let counter = 2;
    while (await store.get(attempt)) {
      attempt = `${slug}-${counter++}`;
    }
    slug = attempt;

    const config = {
      slug,
      title: title.trim(),
      description: (description || "").trim(),
      options,
      createdAt: Date.now(),
    };

    await store.setJSON(slug, config);
    return { statusCode: 201, headers, body: JSON.stringify({ slug }) };
  }

  return { statusCode: 405, headers, body: "Method not allowed" };
};
