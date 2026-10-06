# Administrator redesign: regression and QA record

Branch `feature/admin-ui-redesign`, 10 phases, compared with `main` at `1daee24`.
Presentation and usability only. No backend, API, auth or dependency changes.

## How it was checked

| Check | Result |
|---|---|
| Frontend lint (`npm run lint`) | Pass |
| Type-check (`npx tsc --noEmit`) | Pass |
| Production build (`npm run build`) | Pass |
| Frontend tests (`npm test`, Vitest) | 533 / 533 pass (469 before the redesign) |
| Backend tests (`pytest`, in-memory SQLite) | 625 / 625 pass. Backend not modified. Run on the checked-out branch `fix/primestone-example-addresses` |
| API contract | No changes vs `main` to `src/lib/actions`, `server-api`, `api-client`, `types`, `session`, `portal-guard`, `roles`, `proxy`, `src/app/api`, `next.config.ts`, `package.json` or the lockfile. The set of backend calls is identical. |
| Shared-component regression | Login, Sign-up, Forgot password, Loan Officer overview and a Loan Officer queue are **pixel-identical** to `main` at 1280px and 390px (same mock data, both builds). |
| Responsive | 10 admin pages × 1440 / 1280 / 1024 / 768 / 390px: no horizontal overflow. |
| Accessibility | axe-core (WCAG 2.2 AA + best practice) on all 50 page/width combinations: 0 violations. Every keyboard stop shows a focus ring; standalone targets are at least 24px. |
| Dialogs | Disbursement dialog and phone nav drawer: focus stays inside, Escape closes, focus returns to the opener. The dialog can't be closed while a disbursement is being recorded. |

Visual checks ran against a read-only mock backend that serves the unit-test fixtures. They never ran against real data.

## What changed, and why

| Area | Before | After | Why |
|---|---|---|---|
| Design foundation | Ad hoc banners, empty states, selects and textareas; no Select, Textarea, Alert, EmptyState, Tabs or Dialog components | Shared `ui/` primitives, type tokens (page 28px, section 20px, KPI 30px, helper 13px), status tones, 44px admin controls | One system instead of copies |
| Shell | 224px sidebar with an indented queue list; 56px header; content capped at 1152px | 240px grouped sidebar with counts (Applications / Loans / Repayments / Administration); 64px header; 1280px content (1440px for the audit log); menu drawer below 1024px | Use desktop space; clearer hierarchy |
| Overview | Five mixed summary cards jumping to sections; seven stacked queues | Four attention cards (Needs decision, Awaiting disbursement, Repayments to verify, Overdue) linking to their queues; a quieter Portfolio row; queues grouped two-up | Answer "what needs me?" first |
| Application Detail | One page of about 2,900px | Compact header, status bar with the next action, action panel beside five tabs (`?tab=` deep links) | Easier to scan; the action is always in reach |
| Disbursement | Inline two-step form | Summary card plus a dialog: fill in (Cancel / Continue), then review exactly what will be recorded (Back / Confirm) | Separate the money step and confirm it deliberately |
| Analytics | Five groups of equal weight; 224px charts | Financial performance headline row, then Portfolio health, Application and Processing performance; 256–288px charts with clearer axes | Hierarchy without changing any figure |
| Settings | Long explanations inline | Name / value / short explanation, with detail under "How it's used"; warning unchanged and first | Easier to scan |
| Audit log | Chronological feed | Table (Date & time, User + IP, Role, Action + summary, Record) with an expandable detail row and before/after values where recorded | Easier to scan and compare |

## Deliberately preserved

- Every backend figure, definition and calculation; analytics date windows and filters; settings validation and versioning.
- Disbursement validation, upload-then-record order, the double-submit lock, evidence reuse on retry and the redirect. Only the container and the button wording changed.
- The forward-only Settings warning, word for word, always visible.
- All Application Detail information. Every panel is in one tab, and all panels stay mounted, so switching tabs loses nothing.
- Everything the audit feed showed, including the IP address on the row. Hidden keys stay hidden, and nothing is shown that the backend doesn't send (users are numbers, not names).
- Routes, active-nav behaviour, RBAC, middleware, and the Customer and Loan Officer areas.

## Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1–3 | Cleaner, uses desktop space, clear navigation | Done: screenshot review at 5 widths |
| 4–5 | Overview prioritises work; finance secondary | Done |
| 6–7 | Application Detail easier; nothing lost | Done: a test walks every tab for every panel |
| 8–9 | Financial actions separated; disbursement behaviour identical | Done: original call, lock, retry and failure tests kept and passing |
| 10–12 | Analytics, Settings, Audit unchanged in behaviour and access | Done: figure, definition, filter and old-feed comparison tests |
| 13–14 | Responsive and accessibility verified | Done in Chromium, against mock data |
| 15–17 | Customer and Officer areas, auth/RBAC, API contracts intact | Done: pixel diff, layout guard tests, contract diff |
| 18–19 | No new dependencies; no duplicate design system | Done: `package.json` and lockfile unchanged |
| 20 | Lint, type-check, build, tests pass | Done |

## Not verified, or open

- **The real end-to-end admin journey was not executed** (approve → disburse → active loan → verify repayment against a live backend). A local sign-in fails at MFA: the local backend's `MFA_ENCRYPTION_KEY` differs from the deployed one, so it can't decrypt TOTP secrets. Recommended before merge: one pass through the journey on a test application in staging.
- Only Chromium was tested. Safari, Firefox, a real phone and a screen reader have not been checked.
- **Branding:** the UI is consistently "PRIMESTONE". "Prime's Vault" survives only in infrastructure identifiers: the Supabase bucket `primes-vault-documents`, the web address `primesvault.vercel.app` (backend staff/UAT docs) and the `pv_` cookie prefix. Whether to rename those is a product/ops decision. Renaming the cookies would sign everyone out.
- **Decisions pending:**
  - "Disbursed" shows the backend's last 30 days, not the calendar month.
  - The Settings short-explanation wording needs a check by the client.
  - Pages other than Overview have no loading indicator, so that `notFound()` keeps returning a real 404.
- **Loan Officer area:** it shares the shell and review panels but deliberately didn't get the new frame. Planned as the next piece of work.
