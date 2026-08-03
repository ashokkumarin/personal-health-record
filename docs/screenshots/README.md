# Screenshots

The files in this folder are placeholders (plain SVGs) so the main README's
image links aren't broken while real screenshots are pending. Replace each
one with a real PNG/JPG **of the same filename** (or update the paths in the
root [README.md](../../README.md) if you rename them):

| File | What to capture |
|---|---|
| `login.svg` | Login or register screen (web) |
| `timeline.svg` | A populated timeline view (web) — a family with a few sample records looks better than an empty state |
| `upload.svg` | The document upload flow/dialog (web) |
| `family-sidebar.svg` | The family/patient tree sidebar navigation (web) |
| `mobile-timeline.svg` | The mobile app's timeline screen |

## Getting realistic-looking data for the screenshots

Don't screenshot an empty account — it doesn't sell the product. Use
[`docker/release/seed-demo-data.mjs`](../../docker/release/seed-demo-data.mjs)
against a throwaway instance to get a demo family with a sample record in a
few seconds:

```bash
node docker/release/seed-demo-data.mjs http://localhost:4000
# creates demo@phr.example / DemoPass123!, a family, a managed member,
# and a sample lab report PDF for that member
```

Then log in as that account in the browser (and/or the mobile app pointed at
the same API) and capture the screens above. Don't run this against an
instance that has real personal data in it, and don't reuse a screenshot
that shows real personal information.

Crop to a reasonable aspect ratio (the placeholders above are 960×600 for
web, 480×900 for mobile) and keep file sizes sane (PNG, optimized — a few
hundred KB each is plenty for a README).
