import sharp from "sharp";
import { createCanvas } from "canvas";

const MAX_DIMENSION = 300;
const THUMBNAIL_QUALITY = 80;

async function normalize(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .toBuffer();
}

async function thumbnailFromImage(buffer: Buffer): Promise<Buffer> {
  return normalize(buffer);
}

async function thumbnailFromPdf(buffer: Buffer): Promise<Buffer> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdfjs-dist's standard-font fetch relies on Node's fetch, which doesn't
  // support file:// URLs — there's no working way to point it at the bundled
  // standard_fonts locally, so it falls back to a default font. Rendering
  // still succeeds; only glyph fidelity for embedded standard fonts suffers,
  // which is acceptable for a thumbnail preview.
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });

  try {
    const doc = await loadingTask.promise;
    const page = await doc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = MAX_DIMENSION / Math.max(baseViewport.width, baseViewport.height);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    return normalize(canvas.toBuffer("image/png"));
  } finally {
    await loadingTask.destroy();
  }
}

/** Best-effort thumbnail generation. Never throws — returns null on any failure. */
export async function generateThumbnail(buffer: Buffer, mimeType: string): Promise<Buffer | null> {
  try {
    if (mimeType === "image/jpeg" || mimeType === "image/png") {
      return await thumbnailFromImage(buffer);
    }
    if (mimeType === "application/pdf") {
      return await thumbnailFromPdf(buffer);
    }
    return null;
  } catch {
    return null;
  }
}
