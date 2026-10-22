import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UPLOAD_DIR } from "@/lib/uploads";

const ALLOWED = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/;
const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm",
};

// Media is served from our own domain because captive-portal clients can only
// reach walled-garden hosts before logging in.
export async function POST(req: Request) {
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || !ALLOWED.test(file.type)) {
    return NextResponse.json({ error: "Envie uma imagem ou vídeo MP4/WebM." }, { status: 422 });
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${EXT[file.type]}`;
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/uploads/${name}` });
}
