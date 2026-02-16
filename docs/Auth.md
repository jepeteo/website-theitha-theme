# Authentication & Authorization

## Flow
1. Browser calls `/members/api/session`
2. Receives JWT if logged in
3. JWT sent to Vercel API
4. Vercel verifies JWT via Ghost JWKS
5. Vercel checks paid status via Ghost Admin API

## Rules
- Never trust client flags
- Paid data only returned after verification
