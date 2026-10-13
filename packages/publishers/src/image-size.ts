export interface ImageSize {
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/**
 * Enough of the file to reach the size: a PNG's IHDR is in its first 24 bytes, a JPEG's SOF follows
 * the JFIF header and quantization tables (well under 4 KB for the files our renderer writes).
 */
const HEADER_BYTES = 4096;

export type ImageFormat = "png" | "jpeg";

/** Reads an image's format and pixel size from its first bytes, without downloading the whole file. */
export async function imageSize(url: string, fetchImpl: typeof fetch = fetch): Promise<ImageSize & { format: ImageFormat }> {
  const response = await fetchImpl(url, { headers: { range: `bytes=0-${HEADER_BYTES - 1}` } });
  if (!response.ok) throw new Error(`${response.status} ${url}: الملف غير موجود على الموقع`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.length >= 24 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
    return { format: "png", width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // Walk the JPEG segments to the first start-of-frame (SOF0–SOF15, except DHT, JPG and DAC).
    for (let at = 2; at + 9 <= bytes.length && bytes[at] === 0xff; at += 2 + view.getUint16(at + 2)) {
      const marker = bytes[at + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { format: "jpeg", height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
      }
    }
  }
  throw new Error(`${url}: تعذّرت قراءة مقاس الصورة (PNG أو JPEG فقط)`);
}

export const sameAspect = (a: ImageSize, b: ImageSize) => a.width * b.height === b.width * a.height;
