# Backend Phase 1 Scaffold

## Scope
- This scaffold is backend-only (no Ghost theme/UI changes).
- Vercel API functions live at root `/api`.
- Shared backend code lives in `/src`.

## Security Model
- Member session JWT is accepted from bearer header or `ghost-members-ssr` cookie.
- JWT is verified server-side against Ghost JWKS in `src/auth/verify-member-jwt.ts`.
- JWKS fetch/cache is handled inside `verify-member-jwt.ts` (TTL from `JWKS_CACHE_TTL`).
- Ghost Admin API calls use signed short-lived Admin JWT (`HS256`, `aud=/ghost/api/admin/`, `exp<=5m`) from `src/services/ghost-admin-client.ts`.
- Paid tier lookup + caching is handled in `src/services/ghost-admin-client.ts` and wired by `src/services/auth-context-resolver.ts`.
- Signal visibility rules are enforced server-side:
  - Anonymous: all locked
  - Free member: `XAUUSD` unlocked, all other symbols locked
  - Paid member: all symbols unlocked

## Implemented Endpoints
- `GET /api/signals/summary`
- `GET /api/signals/list`

## Notes
- `tsconfig.json` uses strict TypeScript mode.
- `api/signals/summary.ts` and `api/signals/list.ts` resolve auth through `resolveAuthContextFromRequest` and apply per-IP rate limiting.
- No client-side secrets are introduced.
- No UI templates, CSS, or widgets are touched in Phase 1.
