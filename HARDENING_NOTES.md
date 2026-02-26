# Security & Consistency Hardening Notes

**Date:** 2026-02-26  
**Scope:** Security fixes, architectural consistency, and test coverage

---

## Summary of Changes

### 1. Admin Privilege Escalation Fix (Critical)
- **File:** `server/src/routes/admin.ts`
- Extracted reusable `enforceRoleHierarchy()` helper used across PATCH, DELETE, set-password, and force-reset routes
- **ADMIN** can now only manage **USER** accounts
- **ADMIN** cannot promote anyone to ADMIN or SUPERADMIN
- **SUPERADMIN** required for all elevated role assignments
- Added last-SUPERADMIN self-demotion protection (cannot demote if you're the only SUPERADMIN)

### 2. Password Route Peer-Protection (Critical)
- **File:** `server/src/routes/admin.ts`
- `POST /admin/users/:id/set-password` and `POST /admin/users/:id/force-reset` now use the same `enforceRoleHierarchy()` as PATCH and DELETE
- ADMIN cannot force-reset or set password for another ADMIN or SUPERADMIN

### 3. SSRF Hardening (High)
- **File:** `server/src/services/llm.ts`
- Reject URLs with embedded credentials (`user:pass@host`)
- Resolve ALL A and AAAA DNS records (not just the first `dns.lookup` result)
- Block `0.x.x.x` (current network) IPs in addition to existing private ranges
- Fail closed if no DNS records are found
- All `fetch()` calls already use `redirect: 'error'` (verified, no change needed)

### 4. Rate Limiting (High)
- **File:** `server/src/routes.ts`
- Added rate limits to previously unprotected endpoints:
  - `GET /api/data/metrics` — 60/min
  - `GET /api/data/fundamentals` — 30/min
  - `GET /api/data/earnings` — 30/min
  - `GET /api/data/news` — 30/min
  - `GET /api/assets/search` — 30/min
  - `POST /api/admin/price-history/backfill` — 5/hr
  - `POST /api/admin/run-daily` — 5/hr
  - `POST /api/admin/screener/run` — 10/hr

### 5. Prompt Template Enum Validation (Medium)
- **No changes needed** — `role` and `outputMode` already use strict `z.enum()` validation
- Verified in `routes.ts` line 404-406

### 6. Timezone Unification (Medium)
- **File:** `server/src/routes.ts`
- `User.timezone` is now the single canonical source of truth
- Preferences GET reads timezone from `User.timezone`
- Preferences POST writes timezone to `User.timezone` (not `UserPreferences`)
- `UserPreferences.timezone` field is no longer read or written by application code

### 7. Canada + Brazil Universe Wiring (Medium)
- **Files:** `server/src/services/scheduler.ts`, `server/src/routes.ts`, `server/src/routes/demo.ts`
- Scheduler cron now runs screener for all 5 universes: SP500, NASDAQ100, CRYPTO, TSX60, IBOV
- Backfill route expanded to accept TSX60/IBOV
- Demo screener route expanded to accept TSX60/IBOV
- Universe JSON data files already existed (`tsx60.json`, `ibov.json`)

### 8. Multi-Market Asset Identity
- **Deferred** to a separate pass — high-risk schema change touching Asset PK, TrackedAsset, PriceHistory, and all lookups

### 9. Invite Code Normalization (Low)
- **File:** `server/src/routes/admin.ts`
- Admin invite creation now applies `.trim().toUpperCase()` consistently
- Registration already normalizes via Zod `.trim().toUpperCase()`

---

## Schema Changes
- **None** in this pass. All fixes are application-level logic changes.

## Migration Notes
- No database migration required
- `UserPreferences.timezone` field remains in schema but is no longer read/written by the app
- Existing `User.timezone` values are preserved and used as canonical

## Test Coverage
- **File:** `server/src/__tests__/security.test.ts`
- 37 tests across 5 suites:
  - Admin Role Escalation Protection (10 tests)
  - SSRF URL Validation (15 tests)
  - Prompt Template Validation (4 tests)
  - Universe Support (3 tests)
  - Invite Code Normalization (5 tests)
