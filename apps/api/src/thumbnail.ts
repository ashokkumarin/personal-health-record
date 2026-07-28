import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

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

// Renders page 1 via poppler's pdftoppm rather than pdfjs-dist + canvas: pdfjs-dist
// generates embedded font data in memory, but the `canvas` package can only load
// fonts from files on disk, so any PDF with an embedded text layer (i.e. anything
// other than a scanned image) rendered as a fully blank thumbnail with no error.
// poppler ships its own font rendering and doesn't have this gap.
async function thumbnailFromPdf(buffer: Buffer): Promise<Buffer> {
  const workDir = await fs.mkdtemp(path.join(tmpdir(), "phr-thumb-"));
  const pdfPath = path.join(workDir, "input.pdf");
  const outPrefix = path.join(workDir, "out");

  try {
    await fs.writeFile(pdfPath, buffer);
    await execFileAsync("pdftoppm", [
      "-jpeg",
      "-singlefile",
      "-f",
      "1",
      "-l",
      "1",
      "-scale-to",
      String(MAX_DIMENSION),
      pdfPath,
      outPrefix,
    ]);
    const rendered = await fs.readFile(`${outPrefix}.jpg`);
    return normalize(rendered);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
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
