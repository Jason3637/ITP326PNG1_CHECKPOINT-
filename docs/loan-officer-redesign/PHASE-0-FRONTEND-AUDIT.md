# Loan Officer redesign: Phase 0 frontend audit

Branch `feature/admin-ui-redesign` at `7d5609a`, audited 2026-10-07. This phase is read-only: no application source changed. The only new file is this document.

It records how the Loan Officer area (`/staff`) works today, which code it shares with the Customer and Administrator areas, and which redesign items the frontend can deliver alone and which need the backend.

The backend was read for reference only (`ITP326PNG1_CHECKPOINT_CMS`, branch `fix/primestone-example-addresses` at `dec1cf3`). It was not modified. Backend references are written as `backend:<path>`.

---

## 1. Stack and commands

| Item | Value |
|---|---|
| Framework | Next.js **16.3.0**, App Router, Turbopack (`next build`). Middleware is `src/proxy.ts`, Next 16's renamed convention. |
| React | 19.2.8 |
| Language | TypeScript 5, `strict`, path alias `@/*` → `src/*` (`tsconfig.json`) |
| Styling | Tailwind CSS v4 through `@tailwindcss/postcss`. Tokens live in `src/app/globals.css` (`:root` + `@theme`); there is no `tailwind.config`. `cn()` = `clsx` + `tailwind-merge` extended with the custom text sizes (`src/lib/utils.ts`). |
| Icons and charts | `lucide-react`; `chart.js` + `react-chartjs-2` (admin only) |
| Data fetching | Server Components call `serverApiFetch()` (`src/lib/server-api.ts`), which uses httpOnly cookie tokens, refreshes once on a 401 and uses `cache: "no-store"`. Mutations are Server Actions in `src/lib/actions/*.ts`. Client components call these actions and then `router.refresh()` / `router.replace()`. There is no SWR, React Query or client fetch for authenticated data. |
| Rendering | Every staff route sets `export const dynamic = "force-dynamic"`. |
| Backend | Flask API at `NEXT_PUBLIC_API_URL` + `/api` (`.env.local.example`) |
| Package manager | **npm** 11.17.0 (`package-lock.json`); Node v24.19.0 locally |
| Tests | Vitest 3.2 + jsdom + Testing Library (`vitest.config.mts`, `vitest.setup.ts`, which polyfills `<dialog>`). Globals are off. Async Server Components are tested by calling them as functions and rendering the JSX they return. |
| Lint | ESLint 9 flat config: `eslint-config-next` core-web-vitals + typescript, plus a custom rule that test hooks must use block bodies (`eslint.config.mjs`). |

Commands:

```bash
npm run dev          # next dev
npm run lint         # eslint
npx tsc --noEmit     # type-check (no script; same as admin QA)
npm test             # vitest run
npm run build        # next build
```

### Baseline results (this audit, unmodified tree)

| Check | Result |
|---|---|
| `npm run lint` | **Pass**: exit 0, no warnings |
| `npx tsc --noEmit` | **Pass**: exit 0, no output |
| `npm test` | **Pass**: 74 files, **533 / 533** tests, 167 s |
| `npm run build` | **Pass**: exit 0, compiled in 85 s. All four `/staff` routes are dynamic (`ƒ`). The only notice is Next's standard "Experiments: serverActions" line, from `bodySizeLimit` in `next.config.ts`. |

No pre-existing failures were found. These numbers match the admin redesign QA record (`docs/admin-redesign-qa.md`: 533/533).

---

## 2. Route map

All files are under `src/app/(staff)/`. The route group adds no URL segment.

| URL | File | Data | Notes |
|---|---|---|---|
| *(layout)* | `layout.tsx` | `GET /auth/me` via `requireAreaUser("officer")` | Renders `PortalShell variant="staff"`. No queue counts are fetched here. |
| `/staff` | `staff/(overview)/page.tsx` | `GET /officer/queues` + 5 × `GET /officer/queues/<q>?per_page=5`, in parallel | Overview. Has `staff/(overview)/loading.tsx`. |
| `/staff/queues/[queue]` | `staff/queues/[queue]/page.tsx` | `GET /officer/queues/<q>?page=&per_page=25[&assigned=]` | `notFound()` for an unknown queue key |
| `/staff/applications/[applicationId]` | `staff/applications/[applicationId]/page.tsx` | `GET /officer/applications/<id>` + `GET /users/<customer_id>/documents?include_superseded=true` (failure tolerated) | Application Review. `notFound()` for a non-numeric id or a backend 404. |
| `/staff/applications/[applicationId]/customer-history` | `.../customer-history/page.tsx` | `GET /officer/applications/<id>/customer-history` | 403 renders a "not available" card. 404 calls `notFound()`. |
| *(error)* | `staff/error.tsx` | none | Client error boundary for the whole `/staff` tree: "Couldn't load the staff portal" + Try again |

**Loading boundaries.** Only the Overview has a `loading.tsx`. This is deliberate and guarded by `staff/not-found-status.test.ts`: a `loading.tsx` above the queue, review or history pages would commit HTTP 200 before `notFound()` runs. **A redesign must not add a `loading.tsx` above those pages.** Use in-page `<Suspense>` instead.

**URL and search params in use:**

| Param | Page | Parsed by | Purpose |
|---|---|---|---|
| `assigned=me\|unassigned` | queue | `parseAssignmentFilter` (`lib/officer-queues.ts`); anything else → `any` | Assignment filter, passed to the backend |
| `page=<n>` | queue | `parsePage`; invalid → 1 | Pagination |
| `requested=<n>` | review | digit regex in `page.tsx` | Success banner after an information request. Shown only if status is `customer_action_required`. |
| `recommended=recommend_approval\|recommend_rejection` | review | `isRecommendationType` | Success banner after a recommendation. Shown only if status is in the sent-to-admin set. Forged values are ignored (tested). |

`queueHref()` builds queue URLs and drops default values. There is no `?tab=` on the officer review screen; the admin screen has one.

---

## 3. Guards, layout and navigation

### Guards (three layers; none is the security boundary, the backend checks the role on every endpoint)

1. `src/proxy.ts` (matcher `/dashboard/:path*`, `/staff/:path*`, `/admin/:path*`): no access or refresh cookie → `/login?next=<path>`. A `pv_role` cookie for another area → that role's home.
2. `src/lib/portal-guard.ts` `requireAreaUser("officer")`: reads `/auth/me`. On `UnauthenticatedError` or `ApiError` → `/login`. If the role isn't `loan_officer` → `/api/session/role` (re-syncs the role cookie). **Admins are redirected out of `/staff`** (`lib/roles.ts` `areaForRole`).
3. Each page catches `UnauthenticatedError` → `redirect("/login")`.

### Shell (shared with the Customer area)

`src/components/layout/PortalShell.tsx`. `variant="staff"` takes the same branch as `variant="customer"`:

```
<div flex min-h-screen bg-neutral-50>
  <Sidebar variant="staff" />                 // hidden < md; w-56 (224px)
  <div flex-1 flex-col>
    <Header ... roleLabel="Loan Officer" />    // h-14 (56px), inner max-w-5xl (1024px)
    <main mx-auto max-w-6xl px-4 pb-24 pt-6 md:pb-6>   // 1152px content
    <BottomNav variant="staff" />             // md:hidden, sticky bottom
```

The Administrator area has its own `AdminFrame` in the same file: 240px sticky sidebar from `lg`, 64px header, drawer below `lg`, `data-density="comfortable"`, `max-w-7xl`.

| Component | File | Staff behaviour |
|---|---|---|
| `Sidebar` → `AreaSidebar` | `components/layout/Sidebar.tsx` | One top item, **Overview** (`/staff`), with the 5 queues indented under it (`staffQueueNavItems`, text-xs, `py-1.5`). Not sticky. **No counts.** Exactly one item is `aria-current`, via `isTopNavItemActive`. |
| `Header` | `components/layout/Header.tsx` | Logo mark, `<h1>Hello, {first name}</h1>` (the only h1 on every page), role badge (hidden < sm), **Notifications bell button with no handler** (decorative), avatar link to `/staff`, `LogoutButton`. The inner width `max-w-5xl` doesn't match `main`'s `max-w-6xl`. |
| `BottomNav` | `components/layout/BottomNav.tsx` | On phones the staff bar has **one item (Overview)**, so the queues are reachable only from the Overview page. |
| `LogoutButton` | `components/layout/LogoutButton.tsx` | `DELETE /api/session`, then `/login` |
| Nav data | `src/lib/nav.ts` | `staffNavItems` (1 item), `staffQueueNavItems` (built from `OFFICER_QUEUES`), `subNavItemsByVariant.staff`, `isTopNavItemActive`, `isNavItemActive` |

---

## 4. Data and API map

All authenticated calls go through `serverApiFetch` (server-only). Server actions return `{ ok: true, ... } | { ok: false, error }`, never throw to the client, and pass backend messages through `customerSafeMessage()`.

| Purpose | Method and path | Frontend caller | Request / notes |
|---|---|---|---|
| Who am I | `GET /auth/me` | `lib/portal-guard.ts` | |
| Queue counts | `GET /officer/queues` | Overview | Returns `{ queues: {key: {total, mine, unassigned}}, definitions }` |
| Queue page | `GET /officer/queues/<queue>` | Overview (`per_page=5`), queue page (`per_page=25`) | Backend accepts `assigned`, **`officer_id`, `prime_category`** (both unused by the UI), `page`, `per_page` ≤ 100. Order is fixed: `submitted_at ASC, id ASC` (`backend:app/services/officer_views.py:117`). **No search or sort parameter.** |
| Review payload | `GET /officer/applications/<id>` | Review page | **Not a pure read:** it lazily opens checklist rows (`open_checklist_if_needed`). Returns application, customer, documents, checklist, information_requests, recommendations, admin_returns, assignment, credit_assessment, allowed_actions. |
| Earlier document versions | `GET /users/<customer_id>/documents?include_superseded=true` | Review page | Filtered by `relevantEarlierVersions()`. Failure → `null` → "Couldn't load earlier versions". |
| Customer history | `GET /officer/applications/<id>/customer-history` | History page | 403 for officers once the application is decided |
| Claim | `POST /loans/applications/<id>/officer-review` | `claimApplication` (`lib/actions/review-workflow.ts`) | 409 = already claimed |
| Resume | `POST /loans/applications/<id>/resume-review` `{reason?}` | `resumeReview` | Reason required (400) when status is `customer_action_required`. Max 1000 characters. |
| Save one check | `PATCH /officer/applications/<id>/checklist/<item_type>` `{status, note?, date_of_birth?, id_document_id?, id_expiry_date?}` | `updateChecklistItem` (`lib/actions/checklist.ts`) | Returns the full checklist, which goes through `pickChecklist()` before reaching the client |
| Request information | `POST /loans/applications/<id>/request-action` `{requests:[{request_type, reason, required_document_type?, required_information?, internal_note?}]}` | `requestMoreInformation` (`lib/actions/information-requests.ts`) | 1–10 per round |
| Recommend | `POST /loans/applications/<id>/recommend` `{recommendation, comments}` | `submitRecommendation` (`lib/actions/recommendations.ts`) | 409 = checklist not ready or status moved |
| Re-verify customer | `POST /officer/applications/<id>/customer-verification/invalidate` `{note}` | `requestReverification` (`lib/actions/customer-verification.ts`) | 409 = no current verification |
| Open a document | `GET /users/documents/<id>/download` → `{signed_url}` | `getStaffDocumentUrl` (`lib/actions/staff-documents.ts`) | Called only on click. **Every call writes a `document_download` audit row** (backend). |
| Logout / role re-sync | `DELETE /api/session`, `GET /api/session/role` | Next route handlers (`src/app/api/session/**`) | |

Exists on the backend but unused by the officer UI: `GET /officer/applications/<id>/checklist`; `POST /loans/applications/<id>/assign` (**admin-only**); `GET /reports/audit-logs` (**admin-only**, supports `entity_id` = one application's timeline); `GET /admin/pricing` (**admin-only**).

### Types (`src/lib/types.ts`, "Staff" sections, lines ~442–761)

`OfficerQueue`, `QueueAssignmentFilter`, `QueueCount`, `QueueCounts`, `QueueItem`, `QueuePage`, `ApplicationReview` (+ `ReviewApplication`, `ReviewCustomer`, `ReviewCustomerVerification`, `ReviewDocument`, `ReviewChecklist*`, `ChecklistEvidence`, `ReviewInformationRequest`, `ReviewInformationResponse`, `ReviewRecommendation`, `ReviewAdminReturn`, `ReviewCreditAssessment`, `CreditAdvisory`), `CustomerHistory*`, `OfficerRecommendationType`, `ChecklistItemStatus`.

These types are **deliberately partial**: they declare only rendered fields so hidden backend fields (`storage_path`, internal user ids, credit `score`/`eligible`/`recommendation`/`max_eligible_amount`, `credit_evaluation_snapshot`) can't be shown by accident. `AdminApplicationReview extends ApplicationReview`, so changing these types affects the admin screen.

### Queue counts

- Overview tiles: `counts.queues[key].total`. The detail line is `unassigned` for `awaiting_review` and `mine` for every other queue.
- Section badge: `page.total` from each queue page. The comment notes that counts and lists come from the same backend query, so they agree.
- The sidebar shows **no** counts. The admin layout fetches `/admin/queues` for its nav (`app/(admin)/layout.tsx` `navCounts()`); the staff layout has no equivalent.
- `QueueItem` fields the backend sends but the UI never renders: **`latest_recommendation`**, **`assigned_at`**, `total_repayable`, `customer_id`.

---

## 5. Component inventory and consumers

Consumers were found with an import grep over `src/` (tests listed separately). **Bold** = shared outside the Loan Officer area.

### Loan Officer components

| Component | Client? | Production consumers | Tests |
|---|---|---|---|
| `components/staff/QueueItemRow.tsx` | no | `(staff)/staff/(overview)/page.tsx`, `(staff)/staff/queues/[queue]/page.tsx` | `QueueItemRow.test.tsx` |
| **`components/staff/history/CustomerHistoryView.tsx`** | no | staff `customer-history/page.tsx`, **`(admin)/admin/applications/[applicationId]/page.tsx`** | `CustomerHistoryView.test.tsx` |
| **`components/staff/review/ApplicationPanel.tsx`** | no | staff review page, **admin application page** | `ApplicantDetails.test.tsx`, `ReviewPanels.test.tsx` |
| **`components/staff/review/CustomerPanel.tsx`** | no | staff review page, **admin application page** | `ApplicantDetails.test.tsx`, `CustomerVerification.test.tsx` |
| **`components/staff/review/DocumentsPanel.tsx`** | no | staff review page, **admin application page** | `ApplicantDetails.test.tsx`, `ReviewPanels.test.tsx` |
| **`components/staff/review/CreditAdvisoryPanel.tsx`** | no | staff review page, **admin application page** | `ReviewPanels.test.tsx` |
| **`components/staff/review/VerificationChecklist.tsx`** | yes | staff review page (editable), **admin application page (`editable={false}`)** | `VerificationChecklist.test.tsx`, `CustomerVerification.test.tsx` |
| **`components/staff/review/RequestHistoryPanel.tsx`** | no | staff review page, **admin application page** | `RequestInformation.test.tsx` |
| **`components/staff/review/RecommendationHistoryPanel.tsx`** | no | staff review page, **admin application page** | `Recommendation.test.tsx` |
| **`components/staff/review/DetailList.tsx`** (`DetailList`, `DetailRow`) | no | `ApplicationPanel`, `CustomerPanel`, **admin application page, `admin/loans/[loanId]/page.tsx`, `admin/loans/[loanId]/repayments/[paymentId]/page.tsx`, `admin/loans/LoanSummaryPanel.tsx`, `admin/review/DisbursementForm.tsx`, `admin/review/DisbursementRecordPanel.tsx`** | indirect only |
| **`components/staff/review/DocumentViewButton.tsx`** | yes | `DocumentsPanel`, `RequestHistoryPanel`, **`admin/loans/[loanId]/repayments/[paymentId]/page.tsx`, `admin/repayments/RepaymentListItem.tsx`, `admin/review/DisbursementRecordPanel.tsx`** | indirect only |
| `components/staff/review/RequestReverification.tsx` | yes | `CustomerPanel` (rendered only when `canRequestReverification`; admin never passes it) | `ApplicantDetails.test.tsx`, `CustomerVerification.test.tsx` |
| `components/staff/review/ReviewWorkflowPanel.tsx` | yes | staff review page only | `ReviewWorkflowPanel.test.tsx` |
| `components/staff/review/RequestInformationForm.tsx` | yes | staff review page only | `RequestInformation.test.tsx` |
| `components/staff/review/RecommendationForm.tsx` | yes | staff review page only | `Recommendation.test.tsx` |

Seven of the eleven review components are also rendered by the **Administrator Application Detail** page. That page was just redesigned and verified at 5 widths with axe. Changing them changes the admin screen.

### Layout components (shared by all three areas)

| Component | Consumers | Tests |
|---|---|---|
| **`layout/PortalShell.tsx`** | `(admin)/layout.tsx`, `(dashboard)/layout.tsx`, `(staff)/layout.tsx` | via `staff-guard.test.tsx` |
| **`layout/Sidebar.tsx`** | `PortalShell` (all variants) | `Sidebar.test.tsx`, `AdminNav.test.tsx` |
| **`layout/Header.tsx`** | `PortalShell` (all variants) | `AdminNav.test.tsx` |
| **`layout/BottomNav.tsx`** | `PortalShell` (customer + staff) | none |
| **`layout/LogoutButton.tsx`** | `Header` | none |
| `layout/AdminNav.tsx`, `layout/AdminNavDrawer.tsx` | admin only (`Sidebar`, `PortalShell`) | `AdminNav.test.tsx` |

### `components/ui/` primitives

| Primitive | Used by the Loan Officer area today? | All consumers (production) |
|---|---|---|
| **`Card`** (`Card`, `CardTitle` = h2, `variant="emphasis"`) | yes (every staff page and panel) | 57 files across all areas |
| **`Badge`** | yes | 31 files across all areas, incl. `Header` |
| **`Button`** (+ `buttonClasses`, `loading` prop) | yes (`staff/error.tsx` + 5 review components; none use `loading`, all hand-roll the spinner) | 31 files across all areas |
| **`Logo`** | via shell | auth pages, `Header`, `Sidebar`, `AdminNavDrawer` |
| `Alert` | **no** (staff banners are hand-built `div`s) | admin application, audit-log, settings pages |
| `EmptyState` | **no** (queues hand-build an `Inbox` empty state) | 5 admin pages |
| `PageHeader` | **no** | 5 admin pages |
| `SectionHeader` | **no** | admin overview, analytics, settings; `OverviewKpis`, `MetricTile` |
| `StatusBadge` (+ `lib/status-tone.ts`) | **no** (staff uses `Badge variant="primary"` for every status) | admin application page |
| `Tabs` | **no** | admin application page |
| `Dialog` | **no** | `admin/review/DisbursementForm.tsx` |
| `MetricCard` | **no** (overview tiles and `CustomerHistoryView`'s `Stat` are hand-built) | `OverviewKpis`, `analytics/MetricTile` |
| `Select`, `Textarea`, `Field` | **no** (staff forms hand-build `<select>`/`<textarea>`) | audit-log page; `DisbursementForm`; other ui primitives |
| `Input`, `Checkbox`, `PasswordInput`, `FileUploadField`, `RadioCardGroup` | no | auth, customer and admin forms |

### Shared `lib/` modules the area depends on

| Module | Also used by |
|---|---|
| `lib/officer-queues.ts` (`OFFICER_QUEUES`, `staffStatusLabel`, `assignmentLabel`, `purposeLabel`, `daysWaiting`, `waitingLabel`, `queueHref`) | **`lib/nav.ts`, admin application, audit-log, queue and repayments pages, `admin/AdminQueueItems.tsx`**, `CustomerHistoryView`, `ApplicationPanel` |
| `lib/checklist.ts` | **admin application page, `admin/review/OfficerReviewPanel.tsx`** |
| `lib/recommendations.ts` (`RECOMMENDATION_COPY`, `FORBIDDEN_RECOMMENDATION_WORDING`) | **admin application page, `OfficerReviewPanel.tsx`** |
| `lib/information-requests.ts` (`REQUEST_TYPES` labels, `requiredItems`, `documentNoun`) | **`components/dashboard/respond/RespondForm.tsx` (Customer)**. The labels are worded for both officer and customer. |
| `lib/application-review.ts` (date formatting in PNG time, `toCreditAdvisory`, `CREDIT_CRITERIA`, labels) | ~25 files across the admin area |
| `lib/customer-history.ts` | admin `AdminQueueItems`, `OverviewKpis`, `LoanSummaryPanel`, `PaymentHistoryPanel` |
| `lib/nav.ts` | all three shells |

---

## 6. Application Detail (`/staff/applications/[id]`) structure

One long single-column page, top to bottom (`page.tsx` lines 108–261):

1. "Back to dashboard" link (always `/staff`, even when opened from a filtered queue).
2. Title row: `<h2>Application #{id} · {customer}</h2>`, assignment line (`assignmentLabel`), status `Badge` (`staffStatusLabel`).
3. Success banner after `?requested=`, or after `?recommended=` (with a "Back to your queues" link).
4. `ReviewWorkflowPanel`: Claim, or Resume with a reason. Renders nothing when neither is allowed.
5. `VerificationChecklist`, keyed `${status}:${started}` so it remounts after claim or resume.
6. `RequestInformationForm` if `request_information` is allowed.
7. `RecommendationForm` if either recommend action is allowed.
8. `RecommendationHistoryPanel` (renders nothing with no recommendations).
9. `RequestHistoryPanel` (always rendered; "0 rounds" when empty).
10. `lg:grid-cols-2`: left = `CustomerPanel` + `DocumentsPanel`; right = `ApplicationPanel` + `CreditAdvisoryPanel` + a "Customer history" link card.

**Server/client boundary.** Only `ReviewWorkflowPanel`, `VerificationChecklist`, `RequestInformationForm`, `RecommendationForm`, `RequestReverification` and `DocumentViewButton` are client components. Each receives picked fields only: an id, `pickChecklist()` output, or a counts/labels summary. **The raw review object never crosses to the client**, and `review-page.test.tsx` asserts that hidden fields don't render.

**Gating.** Everything comes from `allowed_actions`: `claim`, `resume_review`, `update_checklist`, `request_information`, `recommend_approval`, `recommend_rejection`. The backend logic is in `backend:app/services/officer_views.py` `_allowed_actions`. The page never re-derives these rules. `checklistLockedReason()` only chooses the explanatory text.

Compared with the admin version (`(admin)/admin/applications/[applicationId]/page.tsx`): the admin page has a `PageHeader`, a `StatusBar` with the next action, a sticky action panel (`#action-panel`, `xl:col-start-2`), and `Tabs` (`overview / verification / documents / credit / history`, all mounted, `?tab=` deep link) that reuse the same staff panels.

---

## 7. Verification

**Checklist items** (backend-defined, `backend:app/services/verification.py` `CHECKLIST`): `age_18_plus`, `valid_id`, `contact_details`, `employment`, `referee`, `proof_of_income` (required only above the amount threshold), `repayment_history`, `application_consistency`. The frontend never hard-codes this list; it renders `checklist.items` in order.

**Statuses:** `verified | failed | not_applicable | pending`. Labels and short button labels are in `lib/checklist.ts`.

**Save logic** (`VerificationChecklist.tsx` → `ChecklistItemRow`):
- Each row holds its own draft (`draftStatus`, `draftNote`, `evidence`), `saving`, `error`, `justSaved` and `editingNote`. **Saving one row never touches another row's unsaved draft.**
- The status picker is a `role="radiogroup"` of `role="radio"` buttons. The note box appears only while the status differs from the saved one, or after "Add note"/"Edit note".
- Validation before the call: `validateChecklistDraft` (a note is required for `failed`/`not_applicable`, max 1000) and `validateEvidence`:
  - `age_18_plus` → `verified` needs a DOB that isn't in the future and gives age ≥ 18.
  - `valid_id` → `verified` needs one of the customer's current ID documents and an expiry that, if given, isn't in the past.
- Save → `updateChecklistItem` (PATCH one item). On success the row resets from the returned item. The parent `setChecklist(next)` updates the summary and badge, then `router.refresh()` updates the server panels (document check badges, recommendation summary).
- Unsaved state shows "Unsaved" + Save/Cancel per row. **There is no navigation guard** (no `beforeunload`, no route-change prompt), so unsaved drafts are lost on navigation.
- A parent remount via `key` resets every draft after claim, resume or a customer response.

**Editability** comes from `allowed_actions.includes("update_checklist")`: the assigned officer or an admin, in status `officer_review` or `customer_action_required` (`backend:loan_processing.CHECKLIST_EDITABLE_STATUSES`).

**Customer-level verification.**
- `CustomerPanel` shows "Verified customer" only from `customer.verification`, with valid-until and verified-by.
- `RequestReverification` (shown only to an officer who can edit the checklist, on a verified customer) invalidates it with a required note and re-opens the identity checks.
- Verified evidence is summarised on the row ("Passport #41 · expires …").

**Document links.** `DocumentsPanel` shows the check status beside each document group (ID → `valid_id`, income → `proof_of_income`, referees → `referee`) and "requested in an open information request" notes. Documents and checks are **not** linked inside the checklist itself.

---

## 8. Information requests

**Sending** (`RequestInformationForm.tsx`):
- Collapsed card → "Start a request" → a list of `ItemEditor` fieldsets, 1–10 per round (`REQUEST_LIMITS.perRound`).
- Fields per item:
  - `request_type`: a select from `REQUEST_TYPES`, 7 types.
  - `reason`: shown to the customer, ≤ 1000.
  - `required_document_type`: optional; `id_verification | proof_of_income | loan_file`.
  - `required_information`: optional, ≤ 500.
  - `internal_note`: optional, staff only, ≤ 1000.
- Per-field errors from `validateRequestDraft`, using `aria-invalid` and `aria-describedby`. The server action re-validates.
- Success → `router.replace(?requested=<n>)` + refresh. The form disappears because `request_information` is no longer allowed. Cancel discards all drafts.
- Drafts live only in component state. A refresh loses them.

**History** (`RequestHistoryPanel.tsx`):
- Requests are grouped into rounds by identical `requested_at` (`groupIntoRounds`), oldest first.
- Each request shows its type, status badge (open = "Waiting on customer", responded, cancelled), reason, required items, internal note (staff only), customer reply and cancel reason.
- Per round: the documents the customer provided (each with a View button) and field changes (old → new via `describeFieldChanges`).

**Cancelling:** there is no per-request cancel. Open requests are cancelled only in bulk by **Resume review** while waiting on the customer (a reason is required).

**Customer side:** `components/dashboard/respond/RespondForm.tsx` + `app/(dashboard)/dashboard/applications/[applicationId]/respond/*` consume the same `lib/information-requests.ts` labels.

---

## 9. Recommendation

`RecommendationForm.tsx` + `lib/recommendations.ts` + `lib/actions/recommendations.ts`.

- **Shown when** `recommend_approval` or `recommend_rejection` is in `allowed_actions` (assigned officer, `officer_review`).
- **Input:**
  - Checklist summary computed on the server page: required/complete counts, outstanding labels (failed items excluded), failed labels and `ready`.
  - A `radiogroup` of the two options. Approval is `aria-disabled` and dimmed unless `canRecommendApproval && checklist.ready`, with an explanation in place of the help text.
  - Comments are required, ≤ 2000.
- **Two steps:** "Review and send" validates and shows an inline confirm block (title, irreversibility copy, the comments echoed back). "Send recommendation" posts. "Back" returns to editing. This isn't a modal (`ui/Dialog` is unused here).
- **Payload:** `POST /loans/applications/<id>/recommend` `{ recommendation: "recommend_approval" | "recommend_rejection", comments: trimmed }`. The backend freezes the checklist and credit snapshot, moves the status to `recommended_for_*`, and refuses approval while checks are blocking (409).
- **Wording rule:** all copy is in `RECOMMENDATION_COPY`. `FORBIDDEN_RECOMMENDATION_WORDING` (approved / rejected / disbursed / funds …) is asserted against the copy and the rendered review screen in tests. **Any new copy must pass this regex.**
- **History:** `RecommendationHistoryPanel` shows each recommendation with its frozen checklist (in `<details>`) and any admin returns linked by `recommendation_id`.

---

## 10. Claim and assignment

- **Claim:**
  - `ReviewWorkflowPanel` shows "Claim and start review" when `claim` is allowed (status `submitted`, any staff member).
  - `POST .../officer-review` assigns the caller, opens the checklist and sets status `officer_review`.
  - A 409 gives "Someone has already claimed this application. Refresh to see who."
  - Success → `router.refresh()`; the checklist remounts via its `key`.
- **Resume:** shown for `resume_review` (assigned officer; `customer_action_required` or `returned_to_officer`). A textarea is required only while waiting on the customer.
- **Assignment display:**
  - Queue rows: `assignmentLabel()` (Assigned to you / Unassigned / Assigned to {name}) + a "Yours" badge.
  - Review header: same label from `review.assignment`.
  - Queue filter: All / Assigned to me / Unassigned (URL `assigned=`).
- **Not available to officers:** release/unclaim, hand over, or reassign. `POST /loans/applications/<id>/assign` is `@roles_required("admin")`, and the admin UI doesn't currently call it either.
- Claiming is possible only from the review screen, not from a queue row.

---

## 11. Advisory credit

`CreditAdvisoryPanel.tsx` + `toCreditAdvisory()` (`lib/application-review.ts`).

- A runtime whitelist copies only `evaluated_at`, `insufficient_data`, `reasons[]` and `criteria_checked[]`. **The score, eligible flag, review/decline recommendation, max amount, model name and stored disclaimer never reach the page**, and tests assert this.
- Renders:
  - the backend label as a badge ("Advisory - not a decision input");
  - one current disclaimer (hard-coded `ADVISORY_DISCLAIMER`, deliberately not the stored one);
  - an insufficient-data note;
  - the notes, then "What was checked" with explanations from `CREDIT_CRITERIA`;
  - the application inputs and the produced-at time.
- The card is dashed-bordered (`border-dashed`) to read as secondary.
- **This is a product/policy constraint, not a styling choice.** A redesign must keep it advisory and must not surface the hidden fields.

---

## 12. History

- **Customer history page** (`customer-history/page.tsx` + `CustomerHistoryView.tsx`):
  - Reached only through an application; there is no customer-id route.
  - Shows 4 stats (previous applications, previous loans, total borrowed, current exposure), the repayment record, penalties (old and new backend shapes), previous applications and loans.
  - Rows are **deliberately not linked**.
  - Officers get 403 once the application is decided.
- **On the review screen:** recommendation history, information-request rounds, document history (superseded versions with what replaced them and whether that was via a request), checklist "by X, at T".
- **There is no single per-application activity timeline.** The full audit trail (`GET /reports/audit-logs?entity_id=`) is admin-only. Timestamps the officer payload does have: `submitted_at`, `assignment.assigned_at`, each request's `requested_at` / `responded_at` / `cancelled_at`, each recommendation's `created_at`, each admin return's `created_at`, each check's `checked_at`, each document's `uploaded_at`.

---

## 13. Responsive and accessibility baseline

From code reading. No browser or axe run was done in this phase. The admin QA record states the Loan Officer overview and one queue were pixel-identical to `main` at 1280 and 390px after the admin redesign.

**Responsive:**
- The sidebar appears at `md` (768px), 224px wide, and isn't sticky (it scrolls away on long review pages).
- Below `md`, the bottom bar has a single "Overview" tab.
- Content is capped at 1152px; the header's inner width is 1024px, so the two are misaligned on wide screens.
- Overview tiles: `grid-cols-2 sm:3 lg:5`.
- Queue rows stack, with metadata moving to a right column at `md`.
- Review page: single column, then a two-column info grid from `lg`. The action panels (checklist, request, recommend) are always above the information, so on desktop the officer scrolls away from the evidence while working the checklist.
- `DetailRow` stacks label over value below `sm`.
- Controls use default density: buttons 40px (`md`) or 32px (`sm`). Checklist status pills and assignment filter chips are 32px tall.
- Sidebar queue sub-links are text-xs with `py-1.5`, about 28px tall: above the WCAG 2.2 24px minimum, below 44px.

**Accessibility** (present today):
- One `h1` per page (Header greeting); `CardTitle` is an `h2`.
- `focusRing` on links; `aria-current="page"` in the nav.
- `role="radiogroup"`/`radio` with `aria-checked` on the checklist and recommendation pickers.
- `role="alert"` on errors; `role="status"` on success banners and "Saved".
- `aria-invalid` + `aria-describedby` on request fields.
- `aria-hidden` on decorative icons; an `sr-only` heading on the Overview tiles; `aria-label` on both `<nav>`s on the queue page.

**Gaps noted** (not verified with tooling):
- The checklist and recommendation radio buttons are tabbable individually with no arrow-key handling (not the full ARIA radio pattern).
- The recommendation approval option uses `aria-disabled` but stays clickable (intentional; it shows the reason).
- The Notifications bell button does nothing.
- The review page's title is an `h2` beside the `h1` greeting. There is no page-level `<title>` per route; check `app/layout.tsx` metadata in Phase 1.
- Error text uses `text-red-700` and `text-danger` inconsistently.
- `staff/error.tsx` shows the same message for every failure.

---

## 14. Tests covering the area (all passing)

| File | Tests | Covers |
|---|---|---|
| `app/(staff)/staff-guard.test.tsx` | 11 | Staff, customer and admin layout guards |
| `app/(staff)/staff/(overview)/dashboard-page.test.tsx` | 5 | Five tiles + labels, row links, preview 5 / "View all", no admin endpoints, 401 → login |
| `app/(staff)/staff/applications/[applicationId]/review-page.test.tsx` | 13 | All panels, hidden fields never render, gating by `allowed_actions`, banners, forged params, 404, claim/resume, checklist remount regression, history fetched by application only |
| `app/(staff)/staff/not-found-status.test.ts` | 2 | Only `(overview)/loading.tsx` exists |
| `components/staff/QueueItemRow.test.tsx` | 5 | Row content |
| `components/staff/review/VerificationChecklist.test.tsx` | 6 | Per-item save, notes |
| `components/staff/review/CustomerVerification.test.tsx` | 10 | Evidence, verified customer, re-verification |
| `components/staff/review/RequestInformation.test.tsx` | 7 | Form + history |
| `components/staff/review/Recommendation.test.tsx` | 9 | Form, blocking, wording, history |
| `components/staff/review/ReviewWorkflowPanel.test.tsx` | 5 | Claim / resume |
| `components/staff/review/ReviewPanels.test.tsx` | 11 | Application, documents, credit panels |
| `components/staff/review/ApplicantDetails.test.tsx` | 7 | Residence and employer display |
| `components/staff/history/CustomerHistoryView.test.tsx` | 6 | History view |
| `components/layout/Sidebar.test.tsx` | 8 | Staff queue sub-nav, single active item |
| `lib/officer-queues.test.ts`, `lib/checklist.test.ts`, `lib/information-requests.test.ts`, `lib/application-review.test.ts` | 13 / 10 / 7 / 9 | Pure helpers |
| `lib/actions/workflow-actions.test.ts` | 18 | Request info, recommend, checklist PATCH, claim, resume (+ customer respond) |
| `proxy.test.ts`, `lib/roles.test.ts`, `app/api/session/session-routes.test.ts` | 11 / 10 / 8 | Routing and session |

**Gaps:**
- **`/staff/queues/[queue]` has no page test** (the admin queue page has one).
- No direct tests for the `requestReverification` / `getStaffDocumentUrl` actions, `BottomNav`, `Header` in staff mode, or `staff/error.tsx`.
- No e2e, visual or axe tests are in the repo; the admin QA ran these outside it.

---

## 15. Differences from the Administrator area (already redesigned)

| Aspect | Loan Officer today | Administrator after redesign |
|---|---|---|
| Frame | Shared customer shell: 224px non-sticky sidebar from `md`, 56px header, 1152px content, bottom bar | `AdminFrame`: 240px sticky grouped sidebar from `lg`, 64px header, drawer below `lg`, 1280px content (1440 wide), comfortable density |
| Nav counts | None | From `/admin/queues` in the layout |
| Overview | 5 equal tiles that jump to in-page anchors, then 5 stacked queue cards | Attention `MetricCard`s linking to queues; portfolio secondary; queues two-up |
| Page header | Ad hoc `h2` + back link | `PageHeader` (title, back, meta, actions) |
| Status | `Badge variant="primary"` for all statuses | `StatusBadge` + `lib/status-tone.ts` |
| Detail layout | One long column; actions above information | Status bar + sticky action panel + `Tabs` with `?tab=` |
| Banners, empty states | Hand-built | `Alert`, `EmptyState` |
| Forms | Hand-built `<select>`/`<textarea>`, manual spinners | `Select`, `Textarea`, `Field`, `Button loading` |
| Confirmation | Inline confirm block | `Dialog` (disbursement) |
| Loading | Overview only | Overview only (same 404 constraint) |

---

## 16. Proposed redesign items: frontend/backend classification

**FRONTEND-ONLY** means the data and endpoints exist today and the work is presentation or client logic only. **BACKEND-NEEDED** means the frontend can't deliver it correctly; the reason is given for each one. Where an item splits, both parts are listed.

### Shell and navigation

| # | Item | Class | Basis |
|---|---|---|---|
| 1 | Desktop-first officer frame (sticky grouped sidebar, 64px header, wider content, comfortable density, drawer below `lg`) | FRONTEND-ONLY | New `PortalShell` branch, as was done for admin. Must not change the customer branch (see Risk R1). |
| 2 | Queue counts in the sidebar | FRONTEND-ONLY | `GET /officer/queues` already returns total/mine/unassigned. Fetch it in `(staff)/layout.tsx` like admin's `navCounts()`, tolerating failure. |
| 3 | Phone access to every queue (drawer, not a 1-item bottom bar) | FRONTEND-ONLY | `AdminNavDrawer` pattern + `ui/Dialog` |
| 4 | Remove or hide the dead Notifications bell for officers | FRONTEND-ONLY | `Header` prop, which is shared, so it must default to the current behaviour |
| 5 | Working notifications (new assignment, customer responded, returned by admin) | BACKEND-NEEDED | The backend has no notification model or endpoint. The frontend could only poll queue counts and compare, which can't tell who changed what or persist read state. |

### Overview and queues

| # | Item | Class | Basis |
|---|---|---|---|
| 6 | "My work first" overview: personal (`mine`) counts above team counts; tiles link to queue pages with `?assigned=me` | FRONTEND-ONLY | `QueueCount.mine` / `unassigned` exist; `queueHref` supports `assigned` |
| 7 | Queue as a scannable table (ID, customer, amount, PRIME, purpose, age, assignment, open requests) | FRONTEND-ONLY | All fields are in `QueueItem` |
| 8 | Show `latest_recommendation` in Sent to Administrator and "claimed X ago" (`assigned_at`) | FRONTEND-ONLY | Both fields are already sent and unused |
| 9 | Filter by PRIME category | Split: param FRONTEND-ONLY; option list BACKEND-NEEDED | The backend accepts `prime_category`, but the tier list is admin-configurable and only readable via the admin-only `GET /admin/pricing`. Hard-coding "PRIME 1–3" would drift when tiers change (analytics already allows up to PRIME 10). It needs the tier names exposed to officers, e.g. in `GET /officer/queues` `definitions`. |
| 10 | Filter by a specific officer | BACKEND-NEEDED | `officer_id` exists, but officers have no endpoint listing staff to build a picker. Names seen on the current page aren't a complete list. |
| 11 | Search by customer name or application number across a queue | BACKEND-NEEDED | No search parameter exists. Client-side filtering only sees the loaded page (25, max 100) and would silently miss matches. |
| 11a | "Go to application #" box | FRONTEND-ONLY | Navigate to `/staff/applications/<id>`; the backend 404s unknown ids |
| 12 | Sort by amount, newest or age | BACKEND-NEEDED | Order is fixed server-side (`submitted_at ASC`). Sorting one page client-side would misorder across pages. |
| 13 | "Time in current stage" (since returned, since customer responded) | BACKEND-NEEDED | No status-entered timestamp. `daysWaiting` deliberately measures from submission (`lib/officer-queues.ts` comment). `assigned_at` covers only claim time. |
| 14 | Claim directly from a queue row | FRONTEND-ONLY | `claimApplication(id)` takes only the id. Product question: claiming without opening the application. |
| 15 | Officer can release, hand over or reassign a claim | BACKEND-NEEDED | `POST .../assign` is admin-only and there is no unclaim. The frontend has no permitted call. |
| 16 | Auto-refresh of queues and counts | FRONTEND-ONLY (polling via `router.refresh()`) / BACKEND-NEEDED for push | Polling uses existing GETs. Real-time push needs SSE or websockets on the backend. |
| 17 | Personal throughput stats (recommendations sent this week, etc.) | BACKEND-NEEDED | No officer-scoped stats endpoint, and the Overview deliberately excludes performance figures (page comment). Also a policy decision. |

### Application Detail

| # | Item | Class | Basis |
|---|---|---|---|
| 18 | Workspace layout: `PageHeader`, status bar with "next step", sticky action column beside the evidence, `Tabs` with `?tab=` (all panels mounted) | FRONTEND-ONLY | `ui/Tabs`, `PageHeader`, `Alert` exist. The admin page is the template. `allowed_actions` gives the next step. |
| 19 | Back link returns to the originating queue and filter | FRONTEND-ONLY | Carry `?from=` or a validated referrer |
| 20 | Previous/next application in the queue | FRONTEND-ONLY | Fetch the queue page; order is deterministic |
| 21 | Status shown with `StatusBadge` tones | FRONTEND-ONLY | `lib/status-tone.ts` already covers every application status |
| 22 | Customer history as an in-page tab | FRONTEND-ONLY | Extra `GET .../customer-history`. Must keep the 403 "not available" state for decided applications. |
| 23 | Loading skeleton for review and queue | FRONTEND-ONLY | Must use in-page `<Suspense>`, **not** `loading.tsx` (404 constraint) |

### Verification

| # | Item | Class | Basis |
|---|---|---|---|
| 24 | Progress header and stepper (x of y required, blocking items as jump links) | FRONTEND-ONLY | `checklist.summary` has everything |
| 25 | Each check shown beside its evidence (document, referee, contact mismatch) | FRONTEND-ONLY | All data is in the payload. Mapping item_type → panel is presentation only. |
| 26 | Unsaved-changes guard (tab switch, navigation, unload) | FRONTEND-ONLY | Row state exists; add `beforeunload` + a link interception or confirm |
| 27 | Save all checks at once | Split: sequential client saves FRONTEND-ONLY; atomic batch BACKEND-NEEDED | The PATCH endpoint is per item. A client loop isn't atomic: a mid-way failure leaves some saved and some not. All-or-nothing needs a batch endpoint. Recommend keeping per-item saves. |
| 28 | Inline document preview (image/PDF) next to the check | FRONTEND-ONLY, with an audit caveat | Signed URL via the existing action. **Each fetch writes a `document_download` audit row.** Load it on demand, never on page render. |
| 29 | "Viewed by me" marker on documents | BACKEND-NEEDED | No per-viewer document state is returned. The audit trail that records views is admin-only. |
| 30 | Full ARIA radio pattern (arrow keys) for status pickers | FRONTEND-ONLY | |

### Information requests

| # | Item | Class | Basis |
|---|---|---|---|
| 31 | Reason templates per request type | FRONTEND-ONLY | Static copy. The customer sees it, so wording needs client sign-off. |
| 32 | Draft survives reload | FRONTEND-ONLY (browser storage) / BACKEND-NEEDED for server drafts | Local storage would hold staff-only internal notes on a possibly shared device (Risk R6). Server drafts don't exist. |
| 33 | Use `ui/Select` / `Textarea` with counters | FRONTEND-ONLY | `Textarea showCount` exists |
| 34 | Cancel or edit a single open request | BACKEND-NEEDED | Only `resume-review` cancels, and it cancels all open requests. There is no per-request cancel or edit endpoint. |
| 35 | Response due date, reminders, overdue requests | BACKEND-NEEDED | No due date field or reminder mechanism on `InformationRequest` |
| 36 | Clearer round timeline ("asked → answered" per item) | FRONTEND-ONLY | `groupIntoRounds` + response data exist |

### Recommendation

| # | Item | Class | Basis |
|---|---|---|---|
| 37 | Recommendation in the sticky action panel, confirm step in `ui/Dialog` | FRONTEND-ONLY | Copy must still pass `FORBIDDEN_RECOMMENDATION_WORDING` |
| 38 | Checklist readiness shown live in the panel | FRONTEND-ONLY | Already refreshed after each save |
| 39 | Comment draft survives reload | FRONTEND-ONLY (local) / BACKEND-NEEDED (server draft) | Same as #32 |
| 40 | Edit or withdraw a sent recommendation | BACKEND-NEEDED | Recommendations are immutable by design. Only the admin can return one. |

### Advisory credit and history

| # | Item | Class | Basis |
|---|---|---|---|
| 41 | Credit notes as a secondary tab or collapsible, disclaimer kept | FRONTEND-ONLY | Keep `toCreditAdvisory` whitelist |
| 42 | Show score, eligibility or max amount | **Not proposed** | Technically frontend-capable, but excluded by product policy (advisory only; enforced in tests) |
| 43 | Application activity timeline from existing timestamps (submitted, claimed, request rounds, responses, cancellations, recommendations, returns, last check) | FRONTEND-ONLY | All timestamps are in `ApplicationReview` (§12) |
| 44 | Complete status timeline (every transition and actor, resume events, checklist edits) | BACKEND-NEEDED | No status-history in the officer payload. The full trail (`/reports/audit-logs?entity_id=`) is admin-only, so the frontend can't read it under an officer token. |
| 45 | Link previous applications or loans from customer history | BACKEND-NEEDED (and policy) | The backend scopes history to one application under review. There is no officer route to another application's or loan's detail outside the queues, and the page deliberately doesn't link them. |

### Shared UI and quality

| # | Item | Class | Basis |
|---|---|---|---|
| 46 | Replace hand-built banners, empty states, tiles and forms with `Alert`, `EmptyState`, `MetricCard`, `Select`, `Textarea`, `Button loading` | FRONTEND-ONLY | Primitives exist and are tested |
| 47 | Responsive and axe pass at 1440/1280/1024/768/390 | FRONTEND-ONLY | As the admin QA did |
| 48 | Page test for `/staff/queues/[queue]` and the missing action tests | FRONTEND-ONLY | |

**Summary:**
- **30 items are entirely FRONTEND-ONLY:** #1–4, 6–8, 11a, 14, 18–26, 28, 30, 31, 33, 36–38, 41, 43, 46–48.
- **5 items split:** the frontend part can ship now and the backend part waits. These are #9 (option list), #16 (push), #27 (atomic save), #32 and #39 (server drafts).
- **13 items are entirely BACKEND-NEEDED:** #5, 10, 11, 12, 13, 15, 17, 29, 34, 35, 40, 44, 45.
- #42 isn't proposed.

---

## 17. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **The shell is shared with the Customer area.** `PortalShell`'s non-admin branch, `Sidebar` (`AreaSidebar`), `Header` and `BottomNav` render the customer dashboard too. | Add a separate staff branch or frame, as `AdminFrame` did. Keep the customer branch byte-identical. Pixel-diff the customer pages at 1280/390. |
| R2 | **Seven review components plus `DetailList` and `DocumentViewButton` are rendered by the just-redesigned Admin Application Detail** and other admin pages. | Prefer wrapping and layout changes in the staff page over changing panel internals. Where panels must change, add opt-in props with today's behaviour as the default, and re-run the admin tests and visual checks. |
| R3 | `lib/information-requests.ts` labels are shown to **customers** (`RespondForm`). | Don't reword `REQUEST_TYPES` for officer-only reasons. |
| R4 | The 404 constraint: any `loading.tsx` above queue, review or history breaks real 404s. | Use in-page Suspense. `not-found-status.test.ts` will catch it. |
| R5 | Field leakage: `ApplicationReview` types are partial on purpose; moving more to client components could serialize hidden fields. | Keep the picked-props pattern (`pickChecklist`, ids only). Keep the `review-page.test.tsx` leak test passing. |
| R6 | Browser-stored drafts would hold staff-only internal notes and customer details on shared devices. | Avoid, or clear on logout (as the wizard-draft cookie is). |
| R7 | Tabs hide panels: an officer may not notice failed or outstanding checks, or open requests, in another tab. | Status bar and action panel must summarise blockers. Use tab counts (`TabItem.count`). |
| R8 | Moving actions into a sticky panel while the checklist stays per-item: unsaved check drafts plus "Send recommendation" could send a stale checklist. | Block or confirm when any row is dirty (add #26 first). |
| R9 | Inline previews and pre-fetching document URLs create audit noise and expiring links. | Fetch on demand only (#28). |
| R10 | Recommendation wording regressions | `FORBIDDEN_RECOMMENDATION_WORDING` tests; route new copy through `RECOMMENDATION_COPY`. |
| R11 | Admins can't open `/staff` at all (they're redirected), so "admin sees the officer view" isn't a test path. | Test the officer screens with officer fixtures only. |
| R12 | No real-backend run is possible locally: the admin QA notes the MFA key mismatch blocks local login. | Plan a staging walkthrough: claim → checks → request → customer response → resume → recommend. |

---

## 18. Data gaps (what the backend doesn't give the officer UI today)

1. No search or sort on `GET /officer/queues/<queue>`.
2. No PRIME tier list readable by an officer (only the admin-only `/admin/pricing`).
3. No staff/officer directory for officers (needed for an `officer_id` filter or hand-over).
4. No status-history or "entered current status at" timestamp on the application or queue item.
5. No per-application activity or audit trail for officers (`/reports/audit-logs` is admin-only).
6. No notifications model or endpoint.
7. No officer self-release or reassign of a claim (`/assign` is admin-only).
8. No per-request cancel or edit, and no due date or reminder, on information requests.
9. No batch or atomic checklist update.
10. No server-side drafts (information requests, recommendation comments).
11. No per-viewer document-viewed state.
12. No officer-scoped performance or throughput figures (also excluded by policy).

Unused data that is already available: `QueueItem.latest_recommendation`, `QueueItem.assigned_at`, `QueueItem.total_repayable`, the `officer_id` / `prime_category` query params, `GET /officer/applications/<id>/checklist`, and `QueueCounts.definitions`.
