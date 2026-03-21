exports.handler = async (event) => {
  const BIN_ID  = process.env.JSONBIN_BIN_ID;
  const API_KEY = process.env.JSONBIN_API_KEY;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (event.httpMethod === "GET") {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY, "X-Bin-Meta": "false" },
    });
    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  if (event.httpMethod === "PUT") {
    const body = JSON.parse(event.body);
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  return { statusCode: 405, headers, body: "Method not allowed" };
};
