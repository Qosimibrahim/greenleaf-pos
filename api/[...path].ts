/**
 * Vercel Serverless Catch-All Proxy Handler: api/[...path].ts
 * Catches all /api/* traffic and forwards requests directly to Render backend (https://greenleaf-pos-api.onrender.com/api/...)
 */

export default async function handler(req: any, res: any) {
  // CORS Headers to ensure no preflight blocks
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Extract path parameters from catch-all query
    const pathQuery = req.query?.path;
    const subPath = Array.isArray(pathQuery)
      ? pathQuery.join("/")
      : typeof pathQuery === "string"
      ? pathQuery
      : "";

    // Preserve search/query parameters
    const rawUrl = req.url || "";
    const queryIndex = rawUrl.indexOf("?");
    const queryString = queryIndex !== -1 ? rawUrl.slice(queryIndex) : "";

    const targetUrl = `https://greenleaf-pos-api.onrender.com/api/${subPath}${queryString}`;

    // Pass through request headers (excluding host)
    const headers: Record<string, string> = {};
    if (req.headers) {
      for (const [key, value] of Object.entries(req.headers)) {
        if (key.toLowerCase() === "host") continue;
        if (typeof value === "string") {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value.join(", ");
        }
      }
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Forward payload for mutation HTTP methods
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method || "")) {
      if (req.body !== undefined && req.body !== null) {
        fetchOptions.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    res.status(response.status);

    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== "content-encoding" && lowerKey !== "transfer-encoding") {
        res.setHeader(key, value);
      }
    });

    const arrayBuffer = await response.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    console.error("[Vercel Proxy Error]:", error);
    return res.status(500).json({
      message: error?.message || "Vercel serverless proxy failed to forward request",
    });
  }
}
