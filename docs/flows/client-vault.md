# FLOW — The client vault (the "Invoices/Receipts" tab)

Every invoice and receipt the portal issues a client is filed, as a PDF, into that client's own
folder, and shown on the client's **Invoices/Receipts** tab (chat 17, Phase 3, v: 2026-09-29, backend
v64, migration 63). Internally it is the **client vault**: the bucket, the columns, the actions and
the sweep leg all say `vault`; only the tab label says "Invoices/Receipts" (Jake renamed it from
"Vault" before shipping).

In plain words: when a client's payment clears and the invoice and receipt are emailed, the same two
PDFs are saved against the client. Any admin can open the client, click the tab and open any of them.
Nobody can upload a file there or delete one.

## Jake's decisions (2026-09-29)

- **The CLIENT's vault only.** VFO files membership documents under the PAYER; here the payer is
  always the client, so every document lands in the client's folder and nowhere else — not the COI's,
  not the payment's.
- **View-only (Jake chose option B).** No upload action, no delete action, no rename — the portal's
  own invoice-and-receipt chain is the ONLY thing that ever puts a file in, and nothing takes one out.
  A financial record cannot be lost by a click.
- **Automatic.** Nobody files anything by hand; there is no "add to vault" button to forget.

## Storage and security

- **Bucket `client-vault`: PRIVATE, NO `storage.objects` policy** (VFO's pattern, its
  `20260709230000_ert_docs_buckets.sql`), PDF only (`allowed_mime_types` `application/pdf`), 50 MB per
  file (`file_size_limit` 52428800). With no policy only the service role reaches it — the edge
  function — so the anon key sees nothing and a signed-in browser holds no Storage rights of its own.
- **Created by migration 63** (`supabase/migrations/20260929150000_client_vault.sql`), which also adds
  `client_payments.invoice_vault_path` and `receipt_vault_path` (text, NULL until filed; VFO's two
  column names). No new public table, so the four SECURITY INVARIANTS are unchanged; the security
  advisor stayed green after it — a policy-less private bucket is not flagged.
- **The path is FIXED: `<client_id>/<document number>.pdf`** (`vaultPath` in `utils/client-vault.ts`),
  e.g. `…/INV-1.2.0180-001-0007.pdf` and `…/REC-1.2.0180-001-0003.pdf`, written with `upsert: true`.
  So a resend REPLACES the file rather than filing a second copy (VFO's random prefix would have
  filed one per send), and a document number appears in a client's folder at most once.
- **Viewing is a 300-second signed URL** (`VAULT_URL_SECONDS`, VFO's lifetime), minted per click
  after the path is checked; the link itself is the only credential and it expires in five minutes.

## Filing — `fileDocumentsToVault`

`utils/client-vault.ts` `fileDocumentsToVault(supabase, { paymentId, clientId, invoiceNumber,
receiptNumber, invoiceB64, receiptB64 })` uploads the two PDFs the chain already rendered and stamps
`invoice_vault_path` / `receipt_vault_path` on the row for each that landed (one update, only the
columns that succeeded). **It NEVER THROWS and never fails its caller**: an upload or stamp error is
logged (`client_vault: filing FAILED …`) and returned as `{ ok: false }`, which the caller ignores —
the client already has the documents by email, and a NULL path is exactly what leg V looks for.

**Where it is called** (`actions/payments/invoice-receipt.ts`, `draftPaymentInvoiceReceipt`): AFTER
the Gmail draft has been created AND `invoice_email_sent` / `invoice_email_sent_at` stamped — VFO's
order, because a Storage hiccup must never cost the client their paperwork. A render or Gmail
failure returns before filing, so **the vault only ever holds documents that were actually drafted
to the client**. Every clearing route (ACH, out-of-order, card) and the admin's **Resend invoice and
receipt** (`resend_payment_email` kind `invoice_receipt`, `force`) go through this one helper, so a
resend re-files the resent PDFs — dated today — over the originals at the same paths
(`client-payment-request.md`, Phase E).

## Refiling — `refileDocumentsToVault` and sweep leg V

`refileDocumentsToVault(supabase, paymentId)` (same file) is for a payment whose documents were
emailed but not filed — a transient Storage failure (GOTCHA #39), or a payment that cleared before
the vault existed. It returns `existing` when both paths are already set, refuses a row whose
`invoice_email_sent` is not true or that lacks either number, then **re-renders both PDFs FROM THE
ROW with the numbers already issued** — never re-allocated — and files them. **The document date is
`invoice_email_sent_at`**, the day they were last emailed (a resend re-stamps it), so the vault copy
matches the latest copy in the client's inbox; the Date Received is still `payment_date`. It sends
nothing and NEVER THROWS. Its only caller is the sweep.

**Leg V `client_vault`** (`flows/nightly-sweep.md`): client-funded, `invoice_email_sent = true`, and
either path NULL; newest `invoice_email_sent_at` first; capped at **`VAULT_LIMIT` = 10** (each row is
two PDF renders); runs **LAST, after housekeeping and just before the heartbeat**, so a slow PDF
service can never cost the bells or the heartbeat their run; needs neither Gmail nor Stripe. A row
that fails is recorded in `results` as `error` but NOT in `sweep_runs.errors` (per-row, not a query
error) — it is simply offered again next run. **Proven live** (v: 2026-09-29): the first real run
after deploy filed six of Test Client's historical pairs; one upload hit a transient "connection
reset" and the next run filed it.

## The two actions (both `AUTH_HANDLERS`, any admin)

| Action | Does |
| --- | --- |
| `load_client_vault` `{ client_id }` | 400 unless `client_id` is a uuid. Lists the client's folder (up to 1000, newest first; the folder placeholder, `id` null, dropped), then joins `client_payments` for that client with either path set, and `strategies` for the name. Each file: `path`, `name`, `kind` (`invoice` / `receipt` from the matching column, else by the `INV-` / `REC-` prefix, else `document`), `size`, `filed_at` (the object's `updated_at`, so a resend moves it), `payment_id`, `strategy`, `amount` (`total_fee`), `payment_date`. A failed list or join is a 500, never a 401 (#12). |
| `load_vault_file_url` `{ client_id, path }` | 400 unless `client_id` is a uuid and `path` starts with `<client_id>/`, contains no `..` and no further `/` — a path that climbs out of the folder it names is refused, not signed. Answers `{ url }`, a 300-second signed URL; a Storage error is a 500. |

Both start `load_`, so `lib/api.js` treats them as reads: ONE automatic retry when a request got no
response at all (a cold start), never after one did. Any admin may open any client's vault —
payments are the portal's shared admin data — so there is no ownership check beyond the session gate.

## The screen

Client → the tab strip reads **Profile ▾ · Payments · Invoices/Receipts**
(`src/components/CoiClients.jsx`). The tab's value is `client_vault` in the EXISTING
`wigClientFeatureTab` sessionStorage key, so a refresh returns to the tab (standing rule 5) and no new
`wig*` key was added — GOTCHA #21's two lists are untouched.

`src/components/ClientVault.jsx`: one card, eyebrow "Invoices / Receipts", a skeleton while loading
(seven columns), the empty state "No documents yet. Every invoice and receipt issued to this client is
filed here automatically.", else a table **Document · Type · Strategy · Amount · Payment date · Filed ·
Size**. **The whole row opens the PDF in a new tab** (standing rule 4, no action control in the row):
the tab is opened BEFORE the signed URL is fetched so the popup blocker does not eat it, its `opener`
is nulled, and a blocked popup shows "Your browser blocked the new tab…" instead. A failed fetch closes
the blank tab and shows the error.

## Tested (sandbox, v: 2026-09-29)

**V1** the tab lists 12 files, a row opens its PDF, a refresh returns to the tab; **V2** a new
card-paid Implementation Fee's invoice and receipt appeared at once; **V3** another client shows the
empty state — all PASSED.

## By design

- **A deleted client leaves its folder in the bucket.** Nothing deletes from the vault, ever — the
  retention is intended (the `document_numbers` rows survive the same way).
- **A payment refunded before its paperwork never gets documents** — leg C excludes refunded rows, so
  nothing is issued, so nothing is filed.
- **A refunded payment's already-issued documents stay filed.** No credit note is issued (the refund
  email is the record); leg V carries no refund condition on purpose — it only files documents that
  were already sent.
- **Provider-funded records have no vault documents** — no invoice or receipt is issued on them.

## Where the pieces live

| Piece | File |
| --- | --- |
| Bucket name, path rule, signed-URL lifetime, `fileDocumentsToVault` | `iag-admin-api/utils/client-vault.ts` |
| Filing after the draft; `refileDocumentsToVault` | `iag-admin-api/actions/payments/invoice-receipt.ts` |
| Leg V | `iag-admin-api/actions/payments/sweep.ts` |
| `load_client_vault`, `load_vault_file_url` | `iag-admin-api/actions/vault/client-vault.ts`, registered in `router/dispatch.ts` |
| Bucket + the two path columns (migration 63) | `supabase/migrations/20260929150000_client_vault.sql` |
| The tab pill | `iag-portal/src/components/CoiClients.jsx` |
| The tab's table | `iag-portal/src/components/ClientVault.jsx` |

## Traps

- **Never add an upload, delete, rename or move action without Jake.** View-only is his decision
  (option B); the invoice-and-receipt chain is the one writer, and "nothing takes a file out" is what
  makes the vault a record.
- **Never make the bucket public and never add an anon (or `authenticated`) policy on
  `storage.objects` for it.** The portal has no Supabase Auth users; the edge function is the only
  reader, and a signed URL minted after the path check is the only way a file leaves. A public bucket
  puts every client's invoices one guessed path away.
- **The path is fixed on purpose — so a resend replaces.** A random or timestamped prefix would file
  a second copy on every resend and two rows with one number in the tab.
- **The vault is NEVER the source of the numbers — `document_numbers` is.** Never allocate, derive or
  check a number by listing the bucket; a file can be missing (not filed yet) and the number is still
  issued. Refiling reads the numbers off the row, never mints one.
- **Filing stays AFTER the draft and stays non-fatal.** Moving it earlier, or letting its failure
  fail the chain, lets a Storage hiccup cost the client their emailed paperwork (and would bell
  `invoice_receipt_failed` for documents that did go out).
- **Never retry the upload inside the webhook** (GOTCHA #39). Leg V is the retry; a loop in the
  in-process chain lengthens the booking a Stripe delivery is waiting on.
