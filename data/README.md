# data/

## Active files (used by the app)

| File | Purpose |
|------|---------|
| `catalog.json` | Stable course identity — subject, title, description, department, interests |
| `offerings.json` | Per-semester sections — instructor, building, room, times, meetDays |

These two are joined server-side by `lib/loadCourses.ts` to produce the `Course[]` passed to the UI.

## Pipeline files (NOT read by the app)

| File | Purpose |
|------|---------|
| `courses.schema.json` | JSON Schema used by `scripts/scrape-and-validate-courses.mjs` for validation |
