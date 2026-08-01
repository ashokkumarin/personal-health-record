import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { recordTypeLabels, type MedicalRecord, type RecordsClient } from "@phr/shared";

function fileExtension(fileType: string): string {
  if (fileType === "application/pdf") return "pdf";
  if (fileType === "image/png") return "png";
  return "jpg";
}

function safeFileName(record: MedicalRecord): string {
  const base = record.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || recordTypeLabels[record.recordType];
  return `${base}.${fileExtension(record.fileType)}`;
}

// Downloads a record's file to local storage. Server list endpoints don't
// include downloadUrl (only detail fetches do — see records.ts), and the URL
// is signed/short-lived, so this always re-fetches the record first.
export async function downloadRecordFile(
  recordsClient: RecordsClient,
  record: MedicalRecord
): Promise<string> {
  const full = await recordsClient.getRecord(record.id);
  if (!full.downloadUrl) throw new Error("No download URL for this record");
  const dest = new File(Paths.cache, safeFileName(record));
  const downloaded = await File.downloadFileAsync(full.downloadUrl, dest, { idempotent: true });
  return downloaded.uri;
}

export async function downloadAndShareRecord(
  recordsClient: RecordsClient,
  record: MedicalRecord
): Promise<void> {
  const uri = await downloadRecordFile(recordsClient, record);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: record.fileType, dialogTitle: record.title });
  }
}

// expo-sharing only shares one file per call, so multi-select "download all"
// walks the selection and hands each one to the OS share sheet in turn —
// the user picks "Save to Files"/Photos for each before the next opens.
export async function downloadAndShareAll(
  recordsClient: RecordsClient,
  records: MedicalRecord[],
  onProgress?: (done: number, total: number) => void
): Promise<{ failed: MedicalRecord[] }> {
  const failed: MedicalRecord[] = [];
  for (let i = 0; i < records.length; i++) {
    try {
      await downloadAndShareRecord(recordsClient, records[i]);
    } catch {
      failed.push(records[i]);
    }
    onProgress?.(i + 1, records.length);
  }
  return { failed };
}
