# Polar Payments Implementation Plan

Status: implementation plan

Scope: `apps/dashboard-new`, with shared billing persistence in `packages/db`

Last researched: 2026-08-09

## 1. Goal

Add dashboard-only Pro subscription management for Velumn Discord servers using:

- TanStack Start for routes, loaders, and server functions.
- Better Auth for sessions.
- `@polar-sh/better-auth` for authenticated checkout, customer portal, customer identity, and signed webhook dispatch.
- Polar as the payment authority.
- PostgreSQL as the durable local subscription and entitlement projection.

The implementation must support checkout, trial activation, renewals, failed payments, end-of-period cancellation, immediate revocation, portal access, webhook retries, stale events, duplicate events, and existing `OPEN_SOURCE` grants.

No checkout or billing-management control will be added to the marketing application. Marketing may continue linking users into the dashboard, but payment initiation only happens for an authenticated server under `/dashboard/servers/:serverId/billing`.

## 2. Sources

### Primary application reference

- Marble repository: https://github.com/usemarble/marble
- Better Auth configuration: https://github.com/usemarble/marble/blob/main/apps/cms/src/lib/auth/server.ts
- Subscription creation: https://github.com/usemarble/marble/blob/main/apps/cms/src/lib/polar/subscription.created.ts
- Subscription update ordering: https://github.com/usemarble/marble/blob/main/apps/cms/src/lib/polar/subscription.updated.ts
- Cancellation handler: https://github.com/usemarble/marble/blob/main/apps/cms/src/lib/polar/subscription.canceled.ts
- Revocation handler: https://github.com/usemarble/marble/blob/main/apps/cms/src/lib/polar/subscription.revoked.ts
- Entitlement lookup: https://github.com/usemarble/marble/blob/main/apps/cms/src/lib/subscription/access.ts

The inspected shallow clone is at:

```text
/var/folders/hh/016rjgms6sv8xkfx_6y113_40000gn/T/opencode/marble-polar-research
```

### Official integration references

- Better Auth Polar plugin: https://www.better-auth.com/docs/plugins/polar
- Polar Better Auth adapter: https://polar.sh/docs/integrate/sdk/adapters/better-auth
- Adapter source: https://github.com/polarsource/polar-adapters/tree/main/packages/polar-betterauth
- Checkout source: https://github.com/polarsource/polar-adapters/blob/main/packages/polar-betterauth/src/plugins/checkout.ts
- Portal source: https://github.com/polarsource/polar-adapters/blob/main/packages/polar-betterauth/src/plugins/portal.ts
- Webhook source: https://github.com/polarsource/polar-adapters/blob/main/packages/polar-betterauth/src/plugins/webhooks.ts
- Polar customer state: https://polar.sh/docs/integrate/customer-state
- Polar checkout sessions: https://polar.sh/docs/features/checkout/session
- Polar subscription trials: https://polar.sh/docs/features/subscriptions/trials
- Polar customer external IDs: https://polar.sh/docs/features/customer-management#external-id
- Polar webhook delivery: https://polar.sh/docs/integrate/webhooks/delivery
- Polar webhook events: https://polar.sh/docs/integrate/webhooks/events
- Polar customer portal: https://polar.sh/docs/features/customer-portal/navigate-customers
- Polar local webhook testing: https://polar.sh/docs/integrate/webhooks/locally
- TanStack server functions: https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
- TanStack server routes: https://tanstack.com/start/latest/docs/framework/react/guide/server-routes
- Better Auth TanStack integration: https://www.better-auth.com/docs/integrations/tanstack

## 3. Decisions

### 3.1 Billing belongs to a Discord server

The paid entitlement belongs to `db_server`, not to a Better Auth user. A user initiates and owns the Polar customer relationship, but the resulting subscription grants Pro to the Discord server identified by controlled Polar metadata.

The relationship is:

```text
Better Auth user -> Polar customer -> Polar subscription -> Velumn Discord server
```

The Better Auth Polar adapter always uses `session.user.id` as Polar's customer `external_id`. The adapter's `referenceId` is copied into checkout, order, and subscription metadata. Velumn will therefore use:

```text
Polar customer external_id = Better Auth user.id
subscription metadata.referenceId = db_server.id
```

This deliberately follows the adapter's supported model rather than creating a second, custom workspace customer model.

### 3.2 The payer owns portal access

The Polar portal is customer-scoped. A user who purchased any subscription for the server can open their pre-authenticated portal and will see every Velumn subscription they purchased. Other server members can view the server's local billing status but cannot open a payer's portal.

The local subscription stores `purchaserUserId`. Portal authorization requires the authenticated user to match that purchaser, even if they have since lost Discord authority or local server membership. A payer must not be prevented from canceling or repairing their own recurring charge.

If billing ownership needs to move, the first-release procedure is to cancel the existing payer's subscription and let the replacement payer start a new subscription after the old entitlement ends. Changing only `purchaserUserId` cannot transfer a Polar subscription because customer external IDs are immutable. Automatic transfer is not part of the initial implementation.

Deleting a Better Auth user must not automatically delete their Polar customer while subscriptions remain. Do not add Polar customer deletion hooks in this release.

### 3.3 Billing authority must be stronger than local membership

`user_servers` currently has no role or billing capability. Every linked member is presented as a manager. That is not a sufficient billing authorization model.

Before checkout, revalidate the user's Discord authority using the same live guild permission source used by onboarding. Reuse `canManageDiscordGuild` rather than introducing a second permission interpretation. Require Discord ownership or `ManageGuild`/administrator permission. Store the successful purchaser on the checkout attempt and subscription.

If live Discord authority cannot be checked because the token is expired, fail checkout with a reconnect action. Do not silently fall back to ordinary `user_servers` membership.

Reading billing status remains available to any authorized `user_servers` member. Starting checkout requires live Discord billing authority. Opening the payer's portal requires `purchaserUserId === session.user.id`, but does not require current Discord authority.

### 3.4 Use the Better Auth plugin behind Velumn server functions

Install the Polar plugin in `src/lib/auth.ts`, but do not call its generic endpoints directly from arbitrary UI code.

TanStack server functions will expose only:

```ts
startProCheckout({ data: { serverId } })
openBillingPortal({ data: { serverId } })
getBillingPage({ data: { serverId } })
reconcileBilling({ data: { serverId } })
```

The checkout function invokes `auth.api.checkout` server-side with a fixed slug and server-generated fields. It passes `redirect: false`, persists the returned checkout URL/ID when available, and returns only the URL to the browser. The browser cannot provide:

- Polar product IDs.
- Customer IDs.
- Metadata.
- Trial settings.
- Discount IDs.
- Success URLs.
- Return URLs.

The portal function invokes `auth.api.portal` with `redirect: false` only after payer authorization. Adapter `1.8.4` supports one static configuration-time portal return URL, so the portal returns to `/dashboard/servers` rather than a server-specific page.

Do not use `authClient.customer.subscriptions.list({ referenceId })`. In the current adapter, that query accepts a client-controlled reference and uses the organization token without checking Velumn server membership. Billing screens read the local projection instead.

### 3.5 Use the stable adapter-compatible SDK

Do not use the `@polar-sh/sdk@next` public preview or the date-versioned `2026-04` API in this implementation. The Better Auth adapter is built against the stable SDK API.

Target a tested compatible set:

```json
{
  "better-auth": "1.5.6",
  "@polar-sh/better-auth": "1.8.4",
  "@polar-sh/sdk": "0.49.0"
}
```

Confirm peer compatibility and the resolved lockfile during implementation. Do not inherit `apps/dashboard`'s old `@polar-sh/sdk ^0.40.3` declaration.

### 3.6 Keep local entitlement checks off the Polar request path

Polar is the payment authority, but local billing records are the runtime authorization source. Feature checks must not call Polar synchronously.

Webhooks update the local projection. Reconciliation repairs missed events. `db_server.plan` remains a compatibility projection for the bot, not the billing source of truth.

### 3.7 Preserve non-Polar grants

`OPEN_SOURCE` is an independent Pro-equivalent entitlement. A canceled Polar subscription must never overwrite `OPEN_SOURCE` with `FREE`.

Existing `PAID` rows without a verified Polar subscription are treated as `legacy_paid` until audited. A webhook ending one subscription must not remove another valid Polar, open-source, manual, or legacy entitlement.

## 4. What To Learn From Marble

Adopt these patterns:

- Authorize the workspace/server before creating checkout.
- Carry the workspace/server ID through `referenceId` metadata.
- Store subscription lifecycle details locally.
- Keep cancellation and revocation separate.
- Grant access for active and trialing subscriptions.
- Retain access during an end-of-period cancellation until the paid period ends.
- Reject stale subscription snapshots with an atomic database condition.
- Enforce paid features on the server, not only in UI components.

Improve these Marble weaknesses:

- Require `referenceId`; Marble allows checkout to continue when it is absent.
- Reject raw product IDs and all unsupported client checkout fields.
- Map plans by immutable product ID, not a regex over product names.
- Use an upsert so update-before-create webhook order is recoverable.
- Do not catch and swallow webhook database errors. Throw so Polar retries.
- Add deterministic event deduplication, not only timestamp ordering.
- Treat equal timestamps safely.
- Persist Polar customer and purchaser IDs.
- Do not log full customer or webhook payloads.
- Add reconciliation and billing tests.
- Do not use the success redirect as proof of payment.
- Do not load a user-scoped portal without checking who purchased the server subscription.

## 5. Product And Lifecycle Policy

### 5.1 Initial catalog

The initial catalog contains one recurring product:

```text
slug: pro
display price: $89/month
trial: 7 days with payment method collected by Polar
```

The product ID is environment-configured. Sandbox and production product IDs are separate. Before launch, verify through Polar that the product is active, recurring monthly, priced at the expected amount/currency, and configured with the expected trial.

Polar's standard recurring trial collects payment information during checkout. The current marketing claim "No credit card" is incompatible with this implementation. Production checkout stays disabled until that copy is corrected in a separately scoped marketing change. A no-card evaluation would require a separate local trial entitlement and is not part of this payment implementation.

Do not send trial duration from the browser. Prefer configuring the trial on the Polar product. If the adapter must send trial fields, set them in the server-owned checkout invocation only.

### 5.2 Entitled states

Use the full subscription snapshot rather than event names alone.

```text
trialing: entitled
active: entitled
active + cancel_at_period_end: entitled until current_period_end
past_due: not entitled; direct the payer to the portal for payment recovery
paused: not entitled once pause takes effect
canceled: not entitled after effective end
unpaid: not entitled
incomplete: not entitled
incomplete_expired: not entitled
unknown status: fail closed and alert
```

`revoked` is an event, not a Polar subscription status. `subscription.canceled` does not necessarily remove access. Polar documents end-of-period cancellation as an active subscription with `cancel_at_period_end = true`, followed later by `subscription.revoked`, whose snapshot is terminal and normally has `status = canceled`.

### 5.3 Duplicate subscriptions

Keep Polar's "Allow multiple subscriptions" setting disabled.

Before checkout, reject a new attempt when the server already has an entitled subscription. If duplicates still occur, store every subscription and compute Pro while any allowed subscription is entitled. Do not discard a duplicate provider record.

The billing projection returns every distinct purchaser associated with the server. Each purchaser may open only their own Polar portal. The UI must not choose one arbitrary "billing owner" when duplicate subscriptions have different purchasers.

### 5.4 Downgrade behavior

When Pro ends:

- Keep indexed and published content.
- Keep serving and retaining an existing linked custom domain in the first release so payment work remains dashboard-scoped.
- Prevent adding or replacing a custom domain without Pro or Open Source.
- Allow domain removal regardless of plan.
- Do not change public custom-domain routing as part of this implementation.

A later project may define downgrade routing or a grace period. This release only prevents a non-entitled server from adding or replacing a domain.

## 6. Database Design

Add `packages/db/src/schema/billing.ts`.

### 6.1 `polar_subscription`

Store one row per Polar subscription:

```text
id                      text primary key, Polar subscription ID
server_id               Discord snowflake, FK db_server.id, restrict delete
purchaser_user_id       text, FK user.id, set null on delete
polar_customer_id       text not null
checkout_id             text nullable
product_id              text not null
status                  text not null
recurring_interval      text nullable
recurring_interval_count integer nullable
amount                  integer nullable, provider minor units
currency                text nullable
cancel_at_period_end    boolean not null default false
pause_at_period_end     boolean not null default false
trial_start              timestamp nullable
trial_end                timestamp nullable
current_period_start     timestamp nullable
current_period_end       timestamp nullable
started_at               timestamp nullable
canceled_at              timestamp nullable
past_due_at              timestamp nullable
paused_at                timestamp nullable
resumes_at               timestamp nullable
ends_at                  timestamp nullable
ended_at                 timestamp nullable
provider_modified_at     timestamp nullable
last_event_at            timestamp nullable
last_event_type          text nullable
last_event_fingerprint   text nullable
reconciliation_required  boolean not null default false
reconciliation_failures  integer not null default 0
missing_confirmation_count integer not null default 0
last_reconciled_at       timestamp nullable
last_reconciliation_attempt_at timestamp nullable
last_reconciliation_error_code text nullable
first_missing_at         timestamp nullable
reconciliation_claim_id  text nullable
reconciliation_claimed_at timestamp nullable
created_at               timestamp not null default now
updated_at               timestamp not null default now
```

Indexes:

- `server_id`
- `purchaser_user_id`
- `polar_customer_id`
- `product_id`
- `(server_id, status)`

Do not invent missing prices or dates. Persist `null` when the provider omits an optional value. Validate `status` against the actual stable SDK `0.49.0` enum: `incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `canceled`, `unpaid`, and `paused`. Store event names separately; `revoked` is not a status.

### 6.2 `polar_webhook_event`

The Better Auth webhook callback exposes the validated payload but not the Standard Webhooks `webhook-id` header. The first release therefore stores a deterministic payload fingerprint and makes all state changes replacement-style and idempotent.

```text
fingerprint             text primary key
event_type              text not null
resource_id             text nullable
event_at                 timestamp not null
status                   text not null: processed | ignored
reason                   text nullable
received_at              timestamp not null default now
processed_at             timestamp nullable
```

Fingerprint input:

```text
SHA-256 of { eventType, eventTimestampISO, resourceId, normalizedSnapshot }
```

Serialize the tuple with recursively sorted object keys and ISO date strings before hashing. Test key-order independence. Do not store the full webhook payload in the first release; normalized subscription fields and the hash are enough for operations without retaining unnecessary customer PII.

If the system later adds emails, credit grants, or other non-replacement side effects, move webhook ingress to a custom TanStack route that preserves `webhook-id`, insert into a durable queue, and return within two seconds. The plugin callback is sufficient only while webhook work is a small local transaction.

### 6.3 `server_grant`

Track only non-Polar entitlement provenance explicitly. Polar entitlement is derived directly from `polar_subscription` rows so two local Polar records cannot drift.

```text
server_id               Discord snowflake
source                   open_source | manual | legacy_paid
source_id                text
revoked_at               timestamp nullable
created_at               timestamp not null default now
updated_at               timestamp not null default now
primary key (server_id, source, source_id)
```

This avoids guessing whether `db_server.plan = PAID` came from Polar, an operator, or old data.

Effective plan computation:

```text
if any non-revoked open_source grant exists -> OPEN_SOURCE
else if any entitled polar_subscription or non-revoked manual/legacy_paid grant exists -> PAID
else -> FREE
```

Use deterministic grant IDs so backfills are repeatable:

```text
open_source/default
legacy_paid/cutover-2026-08
manual/<operator-grant-id>
```

Update `db_server.plan` transactionally after every subscription or grant change so existing bot scheduling continues to work.

### 6.4 `polar_checkout_attempt`

Checkout attempts are mandatory. They prove checkout-time authorization and prevent two users from concurrently buying Pro for the same server.

```text
id                      uuid/text primary key
server_id               Discord snowflake
user_id                 Better Auth user ID
polar_checkout_id       text unique nullable
status                  pending | succeeded | expired | failed
failure_code            text nullable
last_reconciled_at      timestamp nullable
reconciliation_claim_id text nullable
reconciliation_claimed_at timestamp nullable
created_at              timestamp not null
updated_at              timestamp not null
expires_at              timestamp not null
```

Before calling Polar, lock the `db_server` row in a transaction, expire stale attempts, reject an entitled subscription or unexpired pending attempt, and insert one new pending attempt. Add a partial unique index that permits only one `pending` row per server. This serializes concurrent buyers across application instances.

Send only this controlled metadata through the Better Auth checkout call:

```ts
{
  schemaVersion: 1,
  serverId,
  checkoutAttemptId: attempt.id,
}
```

The Better Auth checkout URL response does not need to contain a parseable checkout ID. The attempt ID travels into Polar metadata and returns on checkout/subscription webhooks. Mark the attempt failed when checkout creation fails, succeeded when a matching entitled subscription arrives, and expired after its short TTL.

### 6.5 DB helpers

Add `packages/db/src/helpers/dashboard-billing.ts` with:

- `getServerBillingProjection`
- `getServerEntitledSubscriptions`
- `getServerBillingOwners`
- `createCheckoutAttempt`
- `failCheckoutAttempt`
- `completeCheckoutAttempt`
- `claimWebhookEvent`
- `upsertPolarSubscriptionSnapshot`
- `recomputeServerPlan`
- `listSubscriptionsForReconciliation`
- `claimSubscriptionsForReconciliation`
- `releaseReconciliationClaim`

The webhook operation must run in one transaction:

1. Insert the event fingerprint with `ON CONFLICT DO NOTHING`; return success immediately for an existing fingerprint.
2. Resolve an existing subscription by Polar subscription ID before applying product policy.
3. For a previously unknown subscription, validate the server, require the configured product, and require a valid checkout attempt from metadata. For an existing verified/imported subscription ID, accept later events only when its immutable server/customer binding matches the stored row; product may change and is handled authoritatively.
4. Upsert the subscription only when the incoming snapshot is newer.
5. If equal-version normalized snapshots match, treat the event as idempotent. If they conflict, set `reconciliation_required` without calling Polar inside the transaction.
6. Recompute `db_server.plan` from subscriptions and non-Polar grants.
7. Mark the event processed or ignored.

An event for an unknown server or a new subscription with an unsupported product is terminal and committed as ignored with a structured reason. If an existing subscription changes to an unsupported product, persist and quarantine the authoritative product change, make that row non-entitled, recompute the plan, and alert instead of leaving its previous entitlement active. A database or temporary provider failure rolls back the entire claim and must escape the handler so Polar retries. The synchronous model intentionally does not claim to preserve failed attempts; durable failure attempts require the future queue design.

Update:

- `packages/db/src/schema/index.ts`
- `packages/db/src/schema/relations.ts`
- Drizzle migration and journal files generated by `db:generate`

Do not hand-number the migration. Before generation, verify the Drizzle journal against both `0002_*.sql` files and confirm which file production applied. Add a separate idempotent backfill script with dry-run counts, unresolved mappings, resumable batches, and no destructive rollback.

## 7. Environment Configuration

Extend `apps/dashboard-new/src/env.server.ts` and the root `.env.example`:

```text
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_PRO_PRODUCT_ID=
POLAR_SERVER=sandbox
CRON_SECRET=
```

Rules:

- `POLAR_SERVER` is `sandbox` or `production`.
- Do not derive Polar environment from `NODE_ENV`; preview builds may use sandbox.
- Use the existing `optionalGroup` pattern so local development can run without billing.
- A partial Polar configuration is a startup error.
- Production checkout remains disabled unless the complete group is present.
- No Polar secret enters `env.public.ts` or a client bundle.
- Success and return URLs are built from `VELUMN_DASHBOARD_NEW_URL`, not stored as separately editable browser values.
- `CRON_SECRET` is validated separately and is required only when the scheduled reconciliation route is deployed.

Add `getPolarEnv()` returning either `null` or:

```ts
{
  accessToken: string
  webhookSecret: string
  productId: string
  server: "sandbox" | "production"
  dashboardOrigin: string
}
```

Extend `src/env.server.test.ts` for complete, absent, partial, invalid-environment, sandbox, and production cases.

## 8. Application Module Map

Keep payment feature code under the requested dashboard feature area.

### 8.1 `src/features/dashboard/billing.ts`

Client-safe types and pure domain rules:

- Allowed Polar status schema.
- `isSubscriptionEntitled`.
- `getBillingDisplayState`.
- Product ID allowlist checks.
- Event freshness comparison.
- Effective plan reduction.
- Browser-safe billing DTO types.

No SDK, environment, database, React, or route imports.

### 8.2 `src/features/dashboard/polar.server.ts`

Server-only provider integration:

- Construct the stable `Polar` client.
- Construct the Better Auth `polar()` plugin configuration.
- Configure checkout slug `pro` with the server product ID.
- Configure the customer portal return URL.
- Configure verified webhook callbacks.
- Normalize Polar subscription payloads into the local snapshot contract.
- Redact provider errors before returning application errors.

Use `createCustomerOnSignUp: false`. Customer creation should happen lazily through authenticated checkout so a Polar outage cannot block Discord sign-in.

Use these plugin modules:

```ts
polar({
  client,
  createCustomerOnSignUp: false,
  use: [
    checkout({
      products: [{ productId, slug: "pro" }],
      authenticatedUsersOnly: true,
      successUrl: defaultSuccessUrl,
      returnUrl: defaultReturnUrl,
    }),
    portal({ returnUrl: `${dashboardOrigin}/dashboard/servers` }),
    webhooks({ secret: webhookSecret, ...handlers }),
  ],
})
```

Do not enable `usage()` because Velumn does not currently have usage-based billing.

Webhook callbacks:

- `onSubscriptionCreated`
- `onSubscriptionUpdated`
- `onSubscriptionActive`
- `onSubscriptionCanceled`
- `onSubscriptionUncanceled`
- `onSubscriptionRevoked`
- `onCustomerStateChanged` as a reconciliation signal

`onSubscriptionUpdated` is authoritative for every status transition, including past due, pause, resume, cancellation, and renewal. The granular callbacks deliver redundant snapshots and call the same reducer. Configure the Polar endpoint for `subscription.created`, `subscription.updated`, and `customer.state_changed`; granular events may be enabled for operations but are not required for correctness.

Do not catch persistence errors in the callback. Better Auth must return non-2xx so Polar retries.

### 8.3 `src/features/dashboard/billing.server.ts`

Server-only application service:

- Authorize billing reads.
- Revalidate Discord billing authority for checkout.
- Ensure the current user may manage the payer-owned portal.
- Call the configured Better Auth checkout and portal APIs.
- Build the exact server-specific checkout success/return URLs and fixed portal return URL.
- Read local billing state.
- Reconcile delayed checkout state from Polar when appropriate.
- Normalize operational errors.

The pinned adapter exposes `auth.api.checkout` and `auth.api.portal`, each returning `{ url, redirect }`. Keep these calls behind this file so adapter upgrades affect one module:

```ts
const checkoutResult = await auth.api.checkout({
  headers,
  body: {
    slug: "pro",
    referenceId: serverId,
    metadata: {
      schemaVersion: 1,
      serverId,
      checkoutAttemptId: attempt.id,
    },
    successUrl: expectedSuccessUrl,
    returnUrl: expectedReturnUrl,
    redirect: false,
  },
})

const portalResult = await auth.api.portal({
  headers,
  body: { redirect: false },
})
```

After a successful mutation, the browser navigates with `window.location.assign(result.url)`.

### 8.4 `src/features/dashboard/billing.functions.ts`

TanStack `createServerFn` wrappers:

```ts
getBillingPage({ data: { serverId } })
startProCheckout({ data: { serverId } })
openBillingPortal({ data: { serverId } })
reconcileBilling({ data: { serverId } })
```

Every function:

- Uses Zod to validate the Discord snowflake.
- Calls `requireServerAuth` and server authorization itself.
- Returns serializable DTOs only.
- Sets authenticated billing responses to `Cache-Control: no-store`.
- Never returns Polar customer IDs, access tokens, webhook payloads, or SDK objects.

`startProCheckout` and `openBillingPortal` are POST functions. `reconcileBilling` is POST and may run at most once per checkout attempt per 60 seconds using `polar_checkout_attempt.last_reconciled_at`. `getBillingPage` is GET. Use TanStack's `setResponseHeader("Cache-Control", "no-store")` API.

### 8.5 `src/features/dashboard/billing.queries.ts`

React Query integration:

```text
["dashboard", "billing", userId, serverId]
```

Add:

- `billingPageQueryOptions`
- `useStartProCheckout`
- `useOpenBillingPortal`
- `useReconcileBilling`

After checkout return, poll only while the local state is `processing`, with a bounded timeout and a manual retry action.

### 8.6 `src/features/dashboard/billing-page.tsx`

Dashboard UI states:

- Billing not configured in this environment.
- Free.
- Starting checkout.
- Checkout returned, activation pending.
- Trialing.
- Active.
- Active and canceling at period end.
- Past due with portal recovery action.
- Ended.
- Open Source.
- Legacy/manual paid.
- Portal opening.
- Provider error.
- Local load/retry error.

Display only information useful to server managers:

- Effective plan.
- Price and interval.
- Trial end.
- Renewal/current period end.
- Scheduled cancellation.
- Payment recovery state.
- Every billing owner, using safe local user display data, with the current user's manageable subscription identified.

Do not build invoice, payment-method, cancellation, or card forms. Use Polar's hosted portal.

### 8.7 Route

Add:

```text
src/routes/dashboard/_authenticated/servers/$serverId/billing.tsx
```

The route:

- Hydrates `billingPageQueryOptions`.
- Uses the same not-found/setup behavior as Publishing.
- Uses `validateSearch` so `checkout` accepts only `"success"` and `checkout_id` accepts only a Polar UUID; invalid values are discarded.
- Treats checkout return as a hint, never proof of payment.
- Shows pending activation while the local webhook projection catches up.
- Delegates rendering to `billing-page.tsx`.

Success URL:

```text
{dashboardOrigin}/dashboard/servers/{serverId}/billing?checkout=success&checkout_id={CHECKOUT_ID}
```

Return URL:

```text
{dashboardOrigin}/dashboard/servers/{serverId}/billing
```

### 8.8 Navigation

Update `src/components/dashboard-shell.tsx` with a Billing item after Publishing.

This is the only shell change. No payment state or provider code belongs in the shell.

### 8.9 Better Auth

Update `src/lib/auth.ts`:

- Import the Polar plugin factory from `polar.server.ts`.
- Add it only when Polar configuration is complete.
- Keep `tanstackStartCookies()` last.
- Add a strict Better Auth `before` hook for `/checkout` as defense in depth.

The checkout hook accepts only this exact server-generated shape:

- A valid session exists.
- `slug === "pro"`.
- `referenceId` is a Discord snowflake.
- `redirect === false`.
- `successUrl` and `returnUrl` exactly equal the canonical URLs recomputed from `referenceId`.
- `metadata` exactly contains the valid pending `schemaVersion`, `serverId`, and `checkoutAttemptId` values created by Velumn.
- `products`, `customFieldData`, `allowDiscountCodes`, `discountId`, `embedOrigin`, `allowTrial`, `trialInterval`, and `trialIntervalCount` are absent.
- No unexpected own keys are present before adapter schema stripping.
- The user passes live Discord billing authorization.
- The pending checkout attempt belongs to the same user and server.
- The server has no current entitled Polar subscription.

The hook matters even if the normal UI uses server functions because Better Auth endpoints remain directly callable HTTP endpoints.

Do not add `polarClient()` to the global browser auth client unless the final server-function approach proves impossible with the pinned adapter. If it must be added, keep all checkout input fixed in one feature hook and retain the Better Auth server-side validation above.

Webhook URL when using the plugin:

```text
POST {dashboardOrigin}/api/auth/polar/webhooks
```

Confirm that the final production URL does not redirect.

## 9. Webhook Processing

### 9.1 Validation

The Better Auth adapter reads the raw body and verifies:

- `webhook-id`
- `webhook-timestamp`
- `webhook-signature`

using Polar's SDK and Standard Webhooks. Velumn handles only the resulting validated payload.

### 9.2 Processing algorithm

For every subscription snapshot:

1. Compute the payload fingerprint.
2. Resolve an existing local subscription by Polar subscription ID.
3. Validate `metadata.referenceId` as a Discord snowflake and resolve the purchaser from the Polar customer's immutable external ID.
4. For a previously unknown subscription, require `productId === POLAR_PRO_PRODUCT_ID` and confirm `checkoutAttemptId` identifies a checkout-time authorization record for the same purchaser and server.
5. For an existing subscription, require its immutable stored server/customer binding. Persist authoritative product changes; an unsupported product makes the row non-entitled and raises an alert.
6. Confirm the server and purchaser exist.
7. Insert the webhook fingerprint with `ON CONFLICT DO NOTHING`.
8. Upsert by Polar subscription ID.
9. Use `provider_modified_at` as the primary snapshot version. Use `last_event_at` only when provider modification time is absent; a newer delivery timestamp must never make an older provider snapshot win.
10. For equal provider versions, compare normalized subscription snapshot hashes. Identical snapshots are idempotent; conflicting snapshots set `reconciliation_required = true` and do not call Polar inside the transaction.
11. Compute Polar entitlement directly from every stored subscription.
12. Recompute the server's effective plan from Polar subscriptions and non-Polar grants.
13. Mark the checkout attempt succeeded when applicable and commit.

Duplicate fingerprints return success without repeating writes.

Unknown new products, malformed references, or customer/server mismatches are recorded as ignored and alerted, but do not provision access. Product changes on existing subscriptions are persisted as described above.

Database failures are thrown. Do not log and return success.

### 9.3 Timing

Polar recommends responding within two seconds and retries failures up to ten times. Keep plugin webhook work to one indexed database transaction with no email or unrelated network calls.

If measured p95 webhook handling approaches one second, replace plugin webhook dispatch with a dedicated TanStack server route and durable worker queue while retaining the same reducer and DB helpers.

### 9.4 Reconciliation

Add reconciliation because webhooks are not an exactly-once ordered stream.

Reconciliation sources:

- `customer.state_changed` callback, which updates the included snapshot or marks affected rows for reconciliation without making an outbound call in the webhook transaction.
- Checkout success page after a short webhook delay.
- Manual operator/server-manager retry.
- Scheduled reconciliation of active, past-due, recently canceled, and stale accounts.

User-triggered reconciliation is the rate-limited `reconcileBilling` POST server function and is scoped to one authorized server/checkout attempt.

Scheduled reconciliation uses a dedicated TanStack server route:

```text
GET /api/internal/billing/reconcile
Authorization: Bearer ${CRON_SECRET}
```

Configure it as a Vercel Cron job. Each invocation atomically claims at most 50 rows using `UPDATE ... FROM (SELECT ... FOR UPDATE SKIP LOCKED) ... RETURNING`, setting a unique `reconciliation_claim_id` and `reconciliation_claimed_at`, then commits the claim. Eligible rows include pending checkout attempts, `reconciliation_required` rows, active/past-due/canceling subscriptions not checked in 24 hours, previous failures, and leases older than the recovery timeout. Process claimed rows with bounded concurrency of five, commit each subscription independently, and clear its lease on completion so one provider failure does not roll back the batch.

For known subscriptions, fetch the full subscription by ID because Customer State contains active subscriptions only. For pending checkout attempts with no known subscription, fetch customer state by the purchaser's external ID and match controlled `checkoutAttemptId`/server metadata. Replace the local subscription projection transactionally and clear `reconciliation_required` on success.

Do not revoke access on one ambiguous `404` or temporary API failure. Record `last_reconciliation_attempt_at`, `last_reconciliation_error_code`, and `first_missing_at`. Increment `missing_confirmation_count` at most once per 24 hours and only treat a known subscription as missing after two confirmed `404` responses separated by at least 24 hours. Reset the missing count and missing/error fields after any successful provider response.

## 10. Billing Authorization

Extend the dashboard management surface union with `billing` for reads, but do not equate this with purchase authority.

Authorization matrix:

| Action                    | Local member | Discord owner/ManageGuild | Current purchaser               |
| ------------------------- | ------------ | ------------------------- | ------------------------------- |
| View server billing state | Required     | Not required              | Not required                    |
| Start checkout            | Required     | Required                  | Not required if no payer exists |
| Retry reconciliation      | Required     | Required                  | Not required                    |
| Open customer portal      | Not required | Not required              | Required                        |
| Remove custom domain      | Required     | Not required              | Not required                    |

If a subscription exists and its purchaser no longer has Discord authority, keep the entitlement active and continue allowing that payer to open their own portal. Other members receive a support-assisted replacement-billing action rather than access to the payer's customer session.

Do not reveal whether an unknown server exists to unauthorized users.

## 11. Feature Enforcement

The current marketing promise makes custom domains the primary technical Pro feature.

Update `src/features/publishing/server.ts`:

- `addPublishingDomain`: require effective `PAID` or `OPEN_SOURCE` entitlement.
- `verifyPublishingDomain`: allow for an existing linked domain.
- `removePublishingDomain`: always allow.

The entitlement check belongs in the server function immediately before mutation. UI disabled states and upgrade prompts are convenience only.

Do not gate unlimited channels or page views because current pricing explicitly includes them in Free.

Keep bot priority behavior through the existing `db_server.plan` projection:

```text
PAID -> highest priority
OPEN_SOURCE -> current open-source priority
FREE -> normal priority
```

## 12. Existing Data And Cutover

Before production checkout is enabled, audit:

- Polar customers whose external ID matches a Better Auth user ID.
- Subscriptions whose `metadata.referenceId` is a Discord server ID.
- The old hard-coded product ID in `apps/dashboard/src/lib/auth.ts`.
- Duplicate Polar customers by email.
- Active subscriptions not represented by `db_server.plan`.
- `PAID` servers without a corresponding Polar subscription.

Backfill policy:

```text
FREE -> no billing entitlement
OPEN_SOURCE -> open_source entitlement
PAID + matched Polar subscription -> import subscription
PAID without matched subscription -> legacy_paid entitlement
active Polar subscription + FREE server -> import and project PAID
unknown server/product -> operator review, no automatic provisioning
multiple active subscriptions -> import all, entitled while any qualifies
```

Run one reconciliation import rather than relying on webhook replay alone.

During cutover:

- Configure exactly one production webhook consumer.
- Update Polar success, return, and webhook URLs to the final dashboard origin.
- Expect users to sign in again if the dashboard cookie host changes.
- Keep rollback capable of reading the new tables without deleting billing history.

## 13. Testing Plan

### 13.1 Pure billing rules

Add `src/features/dashboard/billing.test.ts`:

- Allowed and unknown product IDs.
- Missing and malformed server references.
- Trialing, active, past-due, paused, canceled, unpaid, incomplete, incomplete-expired, and unknown statuses, plus the revoked event.
- End-of-period cancellation before and after period end.
- Multiple subscriptions for one server.
- Open-source and legacy entitlement preservation.
- Newer, stale, duplicate, and equal-timestamp events.
- Update-before-create event order.

### 13.2 Environment

Extend `src/env.server.test.ts`:

- Complete sandbox group.
- Complete production group.
- Entirely absent group.
- Partial group with exact missing variables.
- Empty strings treated as absent.
- Invalid Polar server value.

### 13.3 Authorization

Extend dashboard access tests:

- Billing read for a linked member.
- Unknown and unauthorized server remain indistinguishable.
- Incomplete server policy.
- Disconnected server billing remains available.
- Checkout denied without live Discord billing authority.
- Portal denied to a non-purchaser.
- Former server member who is still the purchaser can open their own portal.
- Direct Better Auth checkout endpoint rejects raw products and override fields.

### 13.4 Database integration

Add integration coverage for:

- Subscription upsert.
- Duplicate event claim.
- Concurrent duplicate delivery.
- Stale event ignored atomically.
- Equal timestamp triggers reconciliation.
- Multiple subscription aggregation.
- Multiple purchasers retain separate portal ownership.
- Imported subscription accepts later events without checkout-attempt metadata.
- Existing subscription moved to an unsupported product loses entitlement.
- Two confirmed missing responses must be separated by 24 hours.
- Reconciliation leases prevent duplicate concurrent batches and recover after timeout.
- `OPEN_SOURCE` preservation.
- `legacy_paid` preservation.
- User deletion sets purchaser null without deleting subscription.
- Server deletion is restricted while billing history exists.

### 13.5 Webhook integration

Exercise `/api/auth/polar/webhooks`:

- Valid signed body.
- Invalid signature.
- Missing Standard Webhooks headers.
- Modified body after signing.
- Duplicate payload.
- Database failure produces non-2xx.
- Unknown product is recorded but not provisioned.
- Reversed cancel/uncancel delivery.
- Past-due recovery.
- Scheduled cancellation followed by revocation.
- Sandbox and production isolation.

### 13.6 Checkout and portal

- Anonymous checkout fails.
- Browser cannot select a product ID.
- Browser cannot override controlled metadata or redirect URLs.
- Unauthorized server returns safe not-found/forbidden behavior.
- Existing active subscription blocks duplicate checkout.
- Provider error is shown beside the action.
- Portal opens only for the purchaser.
- Portal URL is generated fresh and never persisted.
- Success return remains pending until local entitlement exists.

### 13.7 UI and end-to-end states

- Billing unavailable.
- Free.
- Checkout pending.
- Trialing.
- Active.
- Canceling at period end.
- Past due.
- Ended after revocation.
- Open Source.
- Legacy paid.
- Provider failure.
- Delayed webhook and manual retry.
- Desktop and narrow-width billing screens.
- Keyboard and screen-reader operation for checkout, retry, and portal controls.

### 13.8 Bundle and host isolation

Extend production isolation checks so public/marketing bundles do not contain:

- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `POLAR_PRO_PRODUCT_ID`
- server SDK code

Confirm custom tenant hosts reject the auth/webhook API path and the canonical dashboard host accepts it without redirect.

## 14. Local Verification

Use Polar Sandbox only.

Install and authenticate the Polar CLI, then forward to the final Better Auth webhook endpoint:

```bash
polar login
polar listen http://localhost:3001/api/auth/polar/webhooks
```

Use the webhook secret printed by `polar listen` in local environment configuration.

Verify manually:

1. Sign in with Discord.
2. Open a server billing page.
3. Attempt checkout as an unauthorized member.
4. Start Pro checkout as an authorized owner/manager.
5. Return before the webhook completes and observe pending state.
6. Complete sandbox checkout and observe trial/active state.
7. Open the customer portal.
8. Schedule cancellation and confirm access remains through period end.
9. Redeliver webhook events in Polar.
10. Reverse delivery order in tests.
11. Simulate DB failure and confirm Polar receives non-2xx.
12. Confirm an Open Source server never downgrades from a Polar cancellation.

## 15. Implementation Phases

### Phase 1: Decisions and provider audit

- Confirm production product ID and trial/payment-method behavior.
- Confirm final dashboard origin.
- Confirm Discord permission accepted for billing authority.
- Confirm the first-release policy of retaining existing custom-domain routing while blocking new domain additions after entitlement ends.
- Audit existing Polar and `db_server.plan` data.

Exit condition: product and migration rules are written down with no unresolved launch blocker.

### Phase 2: Dependencies and environment

- Add compatible Polar packages to `dashboard-new`.
- Resolve lockfile peer versions.
- Compile the exact stable SDK `0.49.0` webhook models, status enum, optional fields, and `auth.api` signatures; add fixtures from that pinned contract and do not copy `2026-04` preview method shapes.
- Add validated Polar environment configuration and tests.
- Add server-only Polar client/plugin factory.

Exit condition: app builds with billing configured and unconfigured, with no secret in client output.

### Phase 3: Persistence and reducers

- Add billing schema and generated migration.
- Add DB helpers and transactions.
- Add mandatory checkout-attempt locking and authorization records.
- Add pure status/entitlement reducer.
- Add unit and DB integration tests.
- Backfill Open Source and legacy paid provenance.

Exit condition: every lifecycle and ordering test produces a deterministic effective plan.

### Phase 4: Better Auth integration and webhooks

- Install the Polar plugin in Better Auth.
- Add checkout defense-in-depth hook.
- Add idempotent webhook callbacks.
- Configure sandbox endpoint.
- Test signatures, retries, duplicates, and stale events.

Exit condition: sandbox subscription lifecycle updates local records and `db_server.plan` without manual DB edits.

### Phase 5: Dashboard billing actions

- Add authorized billing service and server functions.
- Use the mandatory checkout-attempt lock for duplicate protection and controlled metadata.
- Add payer-scoped portal access.
- Add delayed reconciliation.
- Add query hooks.

Exit condition: no client can control provider IDs, metadata, or redirect URLs.

### Phase 6: Billing UI

- Add billing route and navigation.
- Implement every reachable state.
- Add pending checkout reconciliation.
- Add actionable provider errors.
- Verify desktop and narrow layouts.

Exit condition: the complete sandbox lifecycle is understandable without inspecting Polar or the database.

### Phase 7: Entitlement enforcement

- Gate custom-domain addition server-side.
- Preserve domain removal and recovery behavior.
- Verify bot priority projection.
- Add upgrade entry points beside gated controls.

Exit condition: Free cannot create Pro resources through direct server-function calls.

### Phase 8: Cutover

- Import/reconcile existing production state.
- Configure one production webhook endpoint.
- Run smoke checkout with a production-safe test account/product strategy.
- Monitor webhook failures, ignored events, and reconciliation age.
- Leave the old commented payment sketch untouched; it remains a read-only audit reference outside this implementation scope.

Exit condition: every active paid server has traceable entitlement provenance and recoverable billing owners.

## 16. Required Verification Commands

From `apps/dashboard-new`:

```bash
bun run check
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:production-isolation
```

From `packages/db`:

```bash
bun run db:generate
bun run type-check
bun run test:billing
```

Add `test:billing` and Vitest support to `packages/db`. The command must use an isolated PostgreSQL database from `TEST_DATABASE_URL`, apply all migrations before the suite, and clean its billing fixtures transactionally. Also validate migrations against both an empty database and a production-shaped database before applying them.

## 17. Observability

Use `@repo/logger` for structured billing events without full provider payloads. They flow through the deployment's existing structured log sink; active alert rules are a production operations task and must be configured before cutover rather than implied by application code.

```text
billing.checkout.started
billing.checkout.rejected
billing.portal.opened
billing.webhook.received
billing.webhook.duplicate
billing.webhook.ignored
billing.webhook.failed
billing.subscription.updated
billing.entitlement.changed
billing.reconciliation.started
billing.reconciliation.failed
billing.reconciliation.completed
```

Include only stable operational identifiers:

- Event type.
- Polar subscription ID.
- Server ID.
- Product ID.
- Purchaser user ID where appropriate.
- Resulting effective plan.
- Ignore/failure code.
- Request or trace ID.

Create production log-based alerts for:

- Consecutive webhook failures.
- Unknown products.
- Unknown server references.
- Customer/purchaser mismatches.
- Reconciliation older than the target freshness window.
- Multiple entitled subscriptions for one server.
- `PAID` projection without an active entitlement source.

## 18. Explicit Non-Goals

- Marketing-site checkout.
- Embedded checkout.
- Custom card or invoice UI.
- Usage-based billing.
- Seat billing.
- Annual pricing until separately configured.
- Automatic payer ownership transfer.
- Client-side entitlement decisions.
- Replacing Polar's hosted customer portal.
- Removing `db_server.plan` before the bot is migrated.

## 19. Final Architecture

```text
Authenticated dashboard user
  -> TanStack POST server function
  -> Better Auth session
  -> local server membership
  -> live Discord billing authority
  -> fixed Better Auth Polar checkout slug
  -> Polar hosted checkout

Polar webhook
  -> /api/auth/polar/webhooks
  -> Better Auth adapter raw-body signature verification
  -> idempotent local transaction
  -> subscription snapshot
  -> entitlement sources
  -> db_server.plan compatibility projection

Dashboard and product features
  -> local billing projection
  -> no live Polar dependency on request paths

Authorized purchaser
  -> TanStack POST server function
  -> payer check
  -> Better Auth Polar portal
  -> fresh Polar hosted portal session
```

The central rule is: Polar decides payment state, Velumn persists and reconciles that state, and every runtime feature check uses the local server entitlement projection.
