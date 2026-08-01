# C1 — System Context

The highest-level view: PHR as a single black box, who uses it, and the one
external system it depends on.

```mermaid
C4Context
  title System Context — Personal Health Record (PHR)

  Person(user, "Family member / patient", "Registers, creates families, links patient profiles, uploads and views medical documents")

  System(phr, "Personal Health Record (PHR)", "Lets a family store, organize, search, and selectively share medical documents across linked patient profiles, via web or mobile")

  System_Ext(pdfjs, "pdf.js viewer", "Public page hosted at mozilla.github.io. Renders PDFs client-side so the mobile app doesn't need a native PDF renderer.")

  Rel(user, phr, "Manages families & records", "HTTPS, browser or native app")
  Rel(phr, pdfjs, "Mobile app opens PDFs in", "HTTPS — the viewer page fetches the record's signed download URL directly from the device")

  UpdateLayoutConfig("landscape")
```

## Why there's (almost) nothing external

PHR has no third-party integrations — no email/SMS provider, no payment
processor, no external identity provider, no cloud storage service. Everything
is self-hosted: auth is homegrown JWT, files live on a local filesystem volume,
and the database is a plain PostgreSQL instance (see
[Deployment](../deployment.md)). The **only** external dependency the system
context needs to show is the mobile app's use of the publicly-hosted `pdf.js`
viewer for in-app PDF preview — see
[Mobile app → PDF viewing](../apps/mobile-app.md#pdf-viewing) for why that
approach was chosen (Android's embedded WebView has no built-in PDF renderer).

## Who "the user" actually is

There's a single actor type — no separate admin/staff role at the system-context
level. Within a *family*, a user can hold one of three roles (`OWNER`, `ADMIN`,
`MEMBER`) that gate management actions, and a *patient profile* can be linked to
a user's account or left account-less (e.g. a child or elderly relative who
won't log in themself) — but all of that nuance lives inside the system, not at
this level. See [C3 — Component](c3-component.md) and the
[data model](../data-model.md) for those details.
