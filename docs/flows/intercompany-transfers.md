# VFOS IAG Inter-Company Transfer

VFO Services asks IAG for money owed to it and its people, from the VFO portal (Jake, 2026-11-25). A superadmin answers on
**Accounting → VFOS IAG Inter-Company Transfer**: **Accept and transfer** moves the amount from IAG's Stripe balance to VFO
Services, **Deny** sends a reason back. This is the ONE place IAG's code touches VFO (the starter's Stripe rule names it). (v: 2026-11-25)

## The path

| Step | Where | What happens |
| --- | --- | --- |
| Request | `intercompany_receive` (PUBLIC, signed) | One `intercompany_requests` row per `vfo_key`, however often it arrives; the lines must add up to the amount. Rings `intercompany_request`. VFO sends the email itself |
| Link | `/inter-company-transfers?request=<id>` | `IntercompanyLink.jsx` keeps the id through sign-in (`lib/intercompanyLink.js`) until the request has loaded; a non-superadmin's link is dropped |
| Accept | `accept_intercompany_request` (superadmin) | `utils/intercompany-transfer.ts`: probe VFO's account → claim (`pending` → `processing`, key written) → **ask VFO the request is still open for this exact amount** → `/v1/transfers` → `transferred` → tell VFO |
| Deny | `deny_intercompany_request` (superadmin) | A reason is required; `pending` → `denied` → tell VFO |
| Cancel | `intercompany_withdraw` (PUBLIC, signed) | VFO deleted it: `pending` → `withdrawn`, refused once claimed |

Status: `pending`, `processing`, `transferred`, `denied`, `withdrawn`. A refusal by Stripe (a low balance included) puts it back to
`pending` with `last_error`; nothing moved. Answering or cancelling clears the bell.

## One request, at most one transfer

The claim is a conditional update, so one press wins. The key is per ATTEMPT (#22). An attempt Stripe never answered stays
`processing`: **Check transfer**, and the sweep's leg X, look it up by `transfer_group` `intercompany-<id>` and record it if it went. The
sweep never sends money. After 23 hours an attempt Stripe has no transfer for is released for a fresh Accept, never re-sent.

`vfo_notified_at` is NULL until VFO confirms the answer; leg X tells it again every run (a failure shows on the superadmins' alerts).
VFO proves the money on its own Stripe before it pays anyone, so VFO not confirming means VFO has paid nobody.

`transfer.reversed` for pipeline `INTERCOMPANY` stamps `reversed_*` and rings `intercompany_reversed`; VFO is not told automatically.

## The signed connection

`utils/intercompany.ts`, **with a twin in the VFO backend: change both together.** `{ action, payload, t, sig }`, HMAC-SHA256 over
`action.t.payload`, five minutes. Secrets `INTERCOMPANY_SECRET` (live) and `INTERCOMPANY_SECRET_SANDBOX` (test), the same values on both
projects; the one that verifies a call IS its mode. Live answers go to VFO's one live address; a sandbox request carries its own, accepted
only on VFO's test project. `VFOS_CONNECT_ACCOUNT_ID` / `_SANDBOX` = VFO Services' connected account on IAG's Stripe (the sandbox one is a
stand-in test account, not VFO's).

**Sandbox requests (VFO's test site)** ring and show to the floor superadmin only, and only that login can answer them.

## Screen rules

The lists hold no buttons; a row opens the request. People see amounts, names and dates, never a request number (Jake 2026-11-25), and the
recipient, deals, details and total of each line, never VFO's split of it.
