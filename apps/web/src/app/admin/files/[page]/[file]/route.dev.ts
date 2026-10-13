import fs from "node:fs/promises";
import path from "node:path";
import { pageDir } from "@daydan/content";

const SERVED = /^(mushaf|post|story|tafsir-\d+)\.png$|^caption\.txt$/;

interface Context {
  params: Promise<{ page: string; file: string }>;
}

/** Serves a page's generated files from content/build, so the review shows exactly what was rendered. */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { page, file } = await params;
  if (!/^\d+$/.test(page) || !SERVED.test(file)) return new Response(null, { status: 404 });
  const body = await fs.readFile(path.join(pageDir(Number(page)), file)).catch(() => null);
  if (!body) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": file.endsWith(".png") ? "image/png" : "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
