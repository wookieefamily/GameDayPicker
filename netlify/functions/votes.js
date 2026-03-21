exports.handler = async (event) => {
  const BIN_ID  = process.env.JSONBIN_BIN_ID;
  const API_KEY = process.env.JSONBIN_API_KEY;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  const params = event.queryStringParameters || {};

  // Sanitize inputs
  const poll  = (params.poll  || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const group = (params.group || "default").replace(/[^a-zA-Z0-9_-]/g, "");

  // If a poll slug is provided, namespace the key as "slug_group",
  // otherwise fall back to legacy behaviour (just "group") for existing data.
  const key = poll ? `${poll}_${group}` : group;

  if (event.httpMethod === "GET") {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY, "X-Bin-Meta": "false" },
    });
    const data = await res.json();
    const votes = data[key] || [];
    return { statusCode: 200, headers, body: JSON.stringify({ votes }) };
  }

  if (event.httpMethod === "PUT") {
    const getRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY, "X-Bin-Meta": "false" },
    });
    const existing = await getRes.json();
    const { votes } = JSON.parse(event.body);
    const updated = { ...existing, [key]: votes };

    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY },
      body: JSON.stringify(updated),
    });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod === "DELETE") {
    const getRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY, "X-Bin-Meta": "false" },
    });
    const existing = await getRes.json();
    const updated = { ...existing, [key]: [] };

    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY },
      body: JSON.stringify(updated),
    });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers, body: "Method not allowed" };
};
