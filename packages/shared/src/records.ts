import { z } from "zod";
import { apiRequest, ApiRequestError } from "./http.js";
import type { PatientProfile } from "./family.js";

export type RecordType = "PRESCRIPTION" | "LAB_REPORT" | "PHARMACY_BILL" | "NOTE";

export const recordTypes: RecordType[] = [
  "PRESCRIPTION",
  "LAB_REPORT",
  "PHARMACY_BILL",
  "NOTE",
];

// Display labels only — the underlying values above are unchanged (stored in the
// database and sent over the API as-is) so no data migration is needed for a
// wording change.
export const recordTypeLabels: Record<RecordType, string> = {
  PRESCRIPTION: "Encounter Notes",
  LAB_REPORT: "Lab Report",
  PHARMACY_BILL: "Pharmacy Bill",
  NOTE: "Note",
};

export const uploadRecordFieldsSchema = z.object({
  recordType: z.enum(["PRESCRIPTION", "LAB_REPORT", "PHARMACY_BILL", "NOTE"]),
  title: z.string().min(1, "Title is required"),
  capturedAt: z.string().optional(),
});

export type UploadRecordFields = z.infer<typeof uploadRecordFieldsSchema>;

export const updateRecordFieldsSchema = z.object({
  recordType: z.enum(["PRESCRIPTION", "LAB_REPORT", "PHARMACY_BILL", "NOTE"]).optional(),
  title: z.string().min(1, "Title is required").optional(),
  capturedAt: z.string().optional(),
});

export type UpdateRecordFields = z.infer<typeof updateRecordFieldsSchema>;

export interface MedicalRecord {
  id: string;
  patientId: string;
  recordType: RecordType;
  title: string;
  filePath: string;
  fileType: string;
  thumbnailPath: string | null;
  ocrText: string | null;
  capturedAt: string | null;
  uploadedAt: string;
  createdById: string;
  downloadUrl?: string;
  thumbnailUrl?: string | null;
}

export interface RecordFilters {
  patientId?: string;
  recordType?: RecordType;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}

export interface FilePart {
  uri?: string;
  blob?: Blob;
  name: string;
  type: string;
}

export interface MyTimeline {
  patient: PatientProfile | null;
  records: MedicalRecord[];
}

async function multipartRequest<TResponse>(
  baseUrl: string,
  path: string,
  method: "POST" | "PUT",
  token: string,
  fields: Record<string, string | undefined>,
  file: FilePart
): Promise<TResponse> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, value);
  }

  if (file.blob) {
    form.append("file", file.blob, file.name);
  } else if (file.uri) {
    // React Native's FormData accepts { uri, name, type } file descriptors.
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(res.status, data);
  }
  return data as TResponse;
}

export function createRecordsClient(baseUrl: string, token: string) {
  return {
    uploadRecord: (patientId: string, fields: UploadRecordFields, file: FilePart) =>
      multipartRequest<MedicalRecord>(
        baseUrl,
        `/patients/${patientId}/records`,
        "POST",
        token,
        { recordType: fields.recordType, title: fields.title, capturedAt: fields.capturedAt },
        file
      ),
    replaceRecordFile: (recordId: string, file: FilePart) =>
      multipartRequest<MedicalRecord>(baseUrl, `/records/${recordId}/file`, "PUT", token, {}, file),
    getRecord: (id: string) =>
      apiRequest<MedicalRecord>(baseUrl, `/records/${id}`, { method: "GET", token }),
    listRecords: (familyId: string, filters: RecordFilters = {}) => {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
      ).toString();
      const query = params ? `?${params}` : "";
      return apiRequest<MedicalRecord[]>(baseUrl, `/families/${familyId}/records${query}`, {
        method: "GET",
        token,
      });
    },
    updateRecord: (id: string, input: UpdateRecordFields) =>
      apiRequest<MedicalRecord>(baseUrl, `/records/${id}`, { method: "PATCH", token, body: input }),
    deleteRecord: (id: string) =>
      apiRequest<void>(baseUrl, `/records/${id}`, { method: "DELETE", token }),
    setPatientVisibility: (patientId: string, visibleToFamily: boolean) =>
      apiRequest<PatientProfile>(baseUrl, `/patients/${patientId}/visibility`, {
        method: "PATCH",
        token,
        body: { visibleToFamily },
      }),
    getMyTimeline: () =>
      apiRequest<MyTimeline>(baseUrl, "/me/timeline", { method: "GET", token }),
  };
}

export type RecordsClient = ReturnType<typeof createRecordsClient>;
