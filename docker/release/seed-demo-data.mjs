#!/usr/bin/env node
// Seeds a small, realistic-looking demo family + a couple of sample
// documents against a running PHR instance, purely to make it fast to get
// good-looking screenshots for the README/marketing material — not part of
// the app itself and not run in production.
//
// Usage: node seed-demo-data.mjs [apiBaseUrl]
//   apiBaseUrl defaults to http://localhost:4000

const API = process.argv[2] || "http://localhost:4000";

// Minimal valid single-page PDF (hand-built, no dependencies) so the
// "upload a document" screenshot has something plausible to render.
const DEMO_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 90>>
stream
BT /F1 18 Tf 72 700 Td (Demo Lab Report - Complete Blood Count) Tj ET
BT /F1 12 Tf 72 660 Td (Hemoglobin: 14.2 g/dL - Normal) Tj ET
endstream
endobj
xref
0 6
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`,
  "utf-8"
);

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    throw new Error(`${opts.method || "GET"} ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  console.log(`Seeding demo data against ${API} ...`);

  const { user, token } = await req("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "demo@phr.example",
      password: "DemoPass123!",
      name: "Asha Rao",
    }),
  });
  console.log(`Created demo user: ${user.email} (password: DemoPass123!)`);

  const auth = { Authorization: `Bearer ${token}` };

  const family = await req("/families", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ name: "Rao Family" }),
  });
  console.log(`Created family: ${family.name}`);

  const father = await req(`/families/${family.id}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ mode: "no_account", name: "Suresh Rao", relationship: "Father" }),
  });
  console.log(`Added managed family member: Suresh Rao`);

  const meTimeline = await req("/me/timeline", { headers: auth });
  const selfPatientId = meTimeline.patient?.id;

  for (const [patientId, label] of [
    [selfPatientId, "self"],
    [father.id, "father"],
  ]) {
    if (!patientId) continue;
    const form = new FormData();
    form.append("file", new Blob([DEMO_PDF], { type: "application/pdf" }), "lab-report.pdf");
    form.append("recordType", "LAB_REPORT");
    form.append("title", "Complete Blood Count");
    const res = await fetch(`${API}/patients/${patientId}/records`, {
      method: "POST",
      headers: auth,
      body: form,
    });
    if (!res.ok) {
      throw new Error(`upload for ${label} -> ${res.status}: ${await res.text()}`);
    }
    console.log(`Uploaded a sample lab report for ${label}`);
  }

  console.log("\nDone. Log in as demo@phr.example / DemoPass123! and take screenshots.");
  console.log("Delete this account afterward if the instance isn't a throwaway one.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
