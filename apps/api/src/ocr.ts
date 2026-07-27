import { createWorker } from "tesseract.js";
import { PDFParse } from "pdf-parse";

async function extractFromImage(buffer: Buffer): Promise<string | null> {
  // tesseract.js reports unreadable images via its own error channel, separate
  // from the recognize() promise rejection; an unhandled one crashes the
  // process, so errorHandler is required here to keep a corrupt upload from
  // taking down the server (recognize() below still rejects and is caught normally).
  const worker = await createWorker("eng", undefined, { errorHandler: () => {} });
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text.trim() || null;
  } finally {
    await worker.terminate();
  }
}

async function extractFromPdf(buffer: Buffer): Promise<string | null> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim() || null;
  } finally {
    await parser.destroy();
  }
}

/** Best-effort OCR/text extraction. Never throws — returns null on any failure. */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === "image/jpeg" || mimeType === "image/png") {
      return await extractFromImage(buffer);
    }
    if (mimeType === "application/pdf") {
      return await extractFromPdf(buffer);
    }
    return null;
  } catch {
    return null;
  }
}
