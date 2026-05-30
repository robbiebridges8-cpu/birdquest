# BirdQuest

Gamified bird identification app — record audio or snap a photo, get points based on species rarity for your location and time of year.

## Monorepo structure

```
/apps
  /mobile          React Native + Expo app (TypeScript, NativeWind, expo-router)
/packages
  /rarity          Python — eBird ETL pipeline + rarity scoring engine
  /shared          TypeScript — shared types between mobile and server
/supabase          Migrations and RLS policies
```

## Setup

**Prerequisites:** Node >= 20, pnpm, uv (Python)

```bash
pnpm install              # JS dependencies
cd packages/rarity && uv sync   # Python dependencies
```

## Packages

### `/packages/rarity`
Processes the eBird Basic Dataset into rarity scores. Contains the Jupyter notebook prototype (`rarity_prototype.ipynb`) and the scoring formula used to award points for sightings.

### `/packages/shared`
TypeScript types shared between the mobile app and any future server-side code.

### `/supabase`
Database migrations (Postgres + PostGIS), RLS policies, and seed data.
