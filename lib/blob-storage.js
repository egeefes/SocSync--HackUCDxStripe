// Vercel Blob REST client. Keeps image bytes out of the database on Vercel.
// Locally, data URLs remain supported when BLOB_READ_WRITE_TOKEN is absent.
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export function isBlobUrl(value) {
  return typeof value === "string" && /^https:\/\//i.test(value);
}

export function parseImageDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Unsupported image data URL");
  return { contentType: match[1], bytes: Buffer.from(match[2], "base64") };
}

export async function persistImage(dataUrl, pathname) {
  if (!TOKEN) {
    if (process.env.VERCEL) throw new Error("BLOB_READ_WRITE_TOKEN is required for uploads on Vercel.");
    return dataUrl; // local development fallback
  }
  const { contentType, bytes } = parseImageDataUrl(dataUrl);
  const safePath = pathname.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`https://blob.vercel-storage.com/${safePath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": contentType,
      "x-api-version": "7",
      "x-content-type": contentType,
      "x-add-random-suffix": "1",
      "x-cache-control-max-age": "31536000",
    },
    body: bytes,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Vercel Blob upload failed (${response.status}): ${detail}`);
  }
  const result = await response.json();
  if (!result.url) throw new Error("Vercel Blob did not return a URL");
  return result.url;
}

export async function deleteBlobIfPresent(value) {
  if (!isBlobUrl(value) || !TOKEN) return;
  const response = await fetch("https://blob.vercel-storage.com/delete", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "x-api-version": "7" },
    body: JSON.stringify({ urls: [value] }),
    cache: "no-store",
  });
  if (!response.ok) console.warn("Could not delete old Vercel Blob", response.status);
}
