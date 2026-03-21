exports.handler = async (event) => {
  const BIN_ID  = process.env.JSONBIN_BIN_ID;
  const API_KEY = process.env.JSONBIN_API_KEY;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  // Get group from query string, default to "default"
  const group = (event.queryStringParameters?.group || "default")
    .replace(/[^a-zA-Z0-9_-]/g, ""); // sanitize

  if (event.httpMethod === "GET") {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY, "X-Bin-Meta": "false" },
    });
    const data = await res.json();
    const votes = (data[group] || []);
    return { statusCode: 200, headers, body: JSON.stringify({ votes }) };
  }

  if (event.httpMethod === "PUT") {
    // Fetch whole bin, update just this group
    const getRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY, "X-Bin-Meta": "false" },
    });
    const existing = await getRes.json();
    const { votes } = JSON.parse(event.body);
    const updated = { ...existing, [group]: votes };

    const putRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY },
      body: JSON.stringify(updated),
    });
    const data = await putRes.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  if (event.httpMethod === "DELETE") {
    // Reset just this group
    const getRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY, "X-Bin-Meta": "false" },
    });
    const existing = await getRes.json();
    const updated = { ...existing, [group]: [] };

    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY },
      body: JSON.stringify(updated),
    });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers, body: "Method not allowed" };
};
