import { open, stat, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/uploads";

const TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", webm: "video/webm",
};

// "bytes=100-199", "bytes=100-" or the last N bytes "bytes=-500"
function byteRange(header: string | null, size: number) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!m || (!m[1] && !m[2])) return null;
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return { start, end };
}

const CHUNK_BYTES = 64 * 1024;

// Reads the range one chunk at a time, only when the client asks for more. Readable.toWeb kept
// writing after the phone cancelled a video request mid-transfer (it does that all the time) and
// threw an uncaught "Controller is already closed".
function body(file: string, start: number, end: number) {
  let position = start;
  let handle: FileHandle | undefined;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      handle ??= await open(file, "r");
      const length = Math.min(CHUNK_BYTES, end - position + 1);
      const { bytesRead, buffer } = await handle.read(new Uint8Array(length), 0, length, position);
      position += bytesRead;
      if (bytesRead) controller.enqueue(buffer.subarray(0, bytesRead));
      if (!bytesRead || position > end) {
        controller.close();
        await handle.close();
      }
    },
    async cancel() {
      await handle?.close();
    },
  });
}

// Panel uploads (logo, banners, sponsor video) served from our own domain, the one captive
// portal clients reach before login. Videos are served in byte ranges: iOS only plays them that way.
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  // Names come from the upload route (uuid.ext), so nothing else is served
  const type = /^[\w-]+\.(\w+)$/.exec(name)?.[1];
  const size = type && TYPES[type] ? await stat(path.join(UPLOAD_DIR, name)).then((s) => s.size, () => null) : null;
  if (!size) return new Response("Not found", { status: 404 });

  const file = path.join(UPLOAD_DIR, name);
  const headers = { "Content-Type": TYPES[type!], "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable" };
  const range = byteRange(req.headers.get("range"), size);
  if (!range) return new Response(body(file, 0, size - 1), { headers: { ...headers, "Content-Length": String(size) } });

  if (range.start > range.end) {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }
  return new Response(body(file, range.start, range.end), {
    status: 206,
    headers: {
      ...headers,
      "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      "Content-Length": String(range.end - range.start + 1),
    },
  });
}
