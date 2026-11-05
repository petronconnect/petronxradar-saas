---
name: Petronect public portal — auto-sync feasibility
description: Why we can't reliably auto-scrape the public Petronect tender list, and the realistic alternatives.
---

# Auto-syncing Petronect's published tenders

The client wants Petron Radar to auto-sync every tender Petronect publishes on the public list
(`.../Portal2018/pt/lista_licitacoes_publicadas_ft.html`). The page and official guides were checked
again on 2026-11-05:

- It's a **SAP NetWeaver legacy portal** with client-side rendered content (jQuery + `alasql.min.js`).
  A web-rendered fetch showed a partial public list: 10 rows on page 1 of 31, with number, object,
  substatus, company, scope and dates. A plain server fetch still does not prove a stable bulk feed.
- The official guide describes exporting the visible search results to a spreadsheet. Its documented
  list columns omit monetary value and sector, so that export alone does not satisfy those fields.
- Official supplier guidance says access to a collaboration room follows supplier participation in an
  opportunity. Documents and date changes in that room are not part of the anonymous public listing.
- No official public JSON/CSV API for the full requested dataset or Replit Petronect connector was
  verified; a partial web-renderer response is not evidence of a reliable sync interface.

**Conclusion:** a naive server-side `fetch`/cron scraper is NOT a proven reliable source for all requested
opportunities, values, sectors, documents and collaboration-room date changes. A headless-browser
scraper (Playwright) remains fragile, may risk blocks and is ToS-gray. Don't present it as a trusted
turn-key integration or bypass authenticated supplier access.

**Current app status:** direct Petronect connection and automatic sync are not configured. The old
random-count simulation is disabled; the admin page now supports reviewed, manual CSV import only.

## Realistic alternatives (recommended order)
1. **Assisted import:** use an authorized export, preview duplicates/changes and leave absent monetary
   values or sectors unknown. Do not fabricate those fields from a title or an LLM guess.
2. **Official API/authorized integration:** proceed only after Petronect confirms supported access,
   allowed scopes, update semantics and documentation for the requested details/documents.
3. **Public-page monitor:** at most report visible public fields; it cannot claim full-document,
   collaboration-room, amount/sector or comprehensive-list coverage.

The old in-app direct-sync API was a random-count simulation and has been disabled. Do not describe the
manual CSV mirror as a live Petronect connection or automatic sync.

## Import boundary
The reviewed public-CSV importer writes to a separate administrative mirror and never inserts into or
updates the calculated client opportunity catalog. Amount, sector and documents stay absent unless an
authorized source supplies them. Missing a tender from a paginated export is not evidence that it was
cancelled, so imports never delete records just because they are absent from a file.

**Why:** the public export is partial and lacks fields used by opportunity analysis; blending it into the
calculated catalog or treating page omissions as deletions would create false facts and distort reporting.

**How to apply:** keep public-only records isolated and idempotent. Promote or retire records only after an
authorized source provides the missing fields and reliable status/removal semantics.

**On the client's "send to ChatGPT" idea:** an LLM can't reliably read the Akamai-protected portal
either — AI helps *structure/triage/score* opportunities AFTER we have the raw text, not acquire it.
