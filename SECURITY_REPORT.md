# GranStocks Analytics Security Audit Report
Date: 2026-02-22

## Findings and Mitigations

### 1. Insecure Default Secrets & Production Hardening
**Vulnerability:** The application used insecure default secrets (`JWT_SECRET`, `ENCRYPTION_MASTER_KEY`) and did not halt execution if secure overrides were not provided in production environments.
**Mitigation:** Implemented a synchronous environment variable check in `index.ts`. If `NODE_ENV=production` and secrets do not meet length/complexity requirements, the Fastify instance immediately calls `process.exit(1)`.

### 2. Broken Object Level Authorization (BOLA) & Return Scoping
**Vulnerability:** Custom decorators like `authenticate` and `requireAdmin` were correctly returning 401/403 HTTP codes upon failure, but failed to return immediately in Fastify context, allowing downstream execution to occasionally proceed. Furthermore, missing `userId` scoping on LLM deletes could allow users to delete others' config by ID.
**Mitigation:** 
- Rewrote decorators in `auth.ts` to explicitly `return reply.status(401).send(...)` to properly short-circuit Fastify routing.
- Verified all endpoints referencing dynamic `/:id` parameters contain `userId: authUser.id` Prisma scopes.

### 3. Server-Side Request Forgery (SSRF)
**Vulnerability:** The BYOK LLM implementation allowed users to specify a custom `baseUrl` for their AI Provider. If unvalidated, a malicious user could direct the Fastify backend to proxy requests to internal AWS metadata services (169.254.169.254) or sensitive local intranet surfaces (e.g. `http://localhost:3000`).
**Mitigation:** Implemented `validateBaseUrl` inside `llm.ts`. Strictly filters out HTTP protocols, localhost domains, internal subnets (`10.x.x.x`, `192.168.x.x`, `172.16.x.x`), and strips trailing slashes to enforce a hardened HTTPS proxy tunnel.

### 4. Admin Banning & Password Forced Renewal
**Vulnerability:** Banning a user or setting `mustChangePassword=true` via the Admin panel did not actively invalidate or intercept active session tokens globally across non-auth routes.
**Mitigation:** The global `authenticate` hook now dynamically fetches the user state upon every protected API request. 
- If `status === 'BANNED'`, yields immediate 403.
- If `mustChangePassword === true`, denies access to all protected paths *unless* the request is routed toward `/api/auth` strictly.

### 5. Technical Integrity & Resource Denials
**Vulnerability:** 
- `dateHour` was improperly used for daily Quota aggregations leading to flawed throttling for AI resources. 
- Technical metrics like Volatility and Sharpe ratios were susceptible to Divide-by-Zero errors and `NaN` propagation through Prisma serialization, corrupting the Job orchestration.
**Mitigation:** 
- Normalized Prisma schema schemas (`ScreenerSnapshot`, `AiNarrative`, `AnalysisSnapshot`) to use a strict daily `date` string.
- Injected `Math.max(1, denom)` and `isNaN()` fallbacks forcefully into `screener.ts` algorithmic pipelines.
