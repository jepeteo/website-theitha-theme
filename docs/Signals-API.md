# Signals API

## Endpoints

### GET /signals/summary
Returns live counters.

### GET /signals/list
Returns signals filtered by access level.

## Access Logic
- Not logged in → locked
- Member → XAUUSD full
- Paid → all full

## Security
- JWT required
- Rate limited
