# CalFinder

A small Next.js app that helps UC Berkeley students quickly discover interesting lectures to sit in on during their free time.

## Tech stack

- Next.js (App Router)
- TypeScript
- Hand-written CSS (styled-jsx + a CSS module for the categories page)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

3. Open `http://localhost:3000` in your browser.

Course data is loaded server-side by joining `data/catalog.json` (stable course metadata) and `data/offerings.json` (per-semester sections) in `lib/loadCourses.ts`.

