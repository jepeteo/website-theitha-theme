# Architecture

## Frontend
- Ghost custom theme
- Handlebars templates
- TradingView widgets
- Client JS for fetching signals

## Backend
- Vercel Serverless API
- Postgres DB (signals, statuses, history)

## Auth
- Ghost Members JWT verified server-side
- Paid tier checked via Ghost Admin API

## Data Flow
Browser → Vercel API → DB + Ghost Admin API → filtered response
