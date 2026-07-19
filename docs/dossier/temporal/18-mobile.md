# Mobile (PROMPT-09 §38)

All temporal routes use the existing Flowbite/Tailwind mobile-first system: max-w containers, `overflow-x-auto` around every table (body never scrolls horizontally), field diffs as stacked definition lists on mobile and two columns from `sm:`, native selects for filters, buttons ≥ target size. Proven by the Playwright matrix: 12 routes × 7 viewports (320/390/768/1024/1440/1920/2560) with a hard no-horizontal-overflow assertion — 84 checks green (see reports/ui-responsive-validation.json after `npm run test:responsive`).
