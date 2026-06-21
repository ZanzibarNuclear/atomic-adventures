export async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw Object.assign(new Error("Request body is too large."), { status: 413 });
    }
  }
  return body ? JSON.parse(body) : {};
}

export function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
  return true;
}

export function decodePathPart(value) {
  return decodeURIComponent(value);
}
