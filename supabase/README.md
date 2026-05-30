# Supabase Schema

## Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends auth.users) with username, display_name, total_points |
| `species` | eBird taxonomy — 10k+ species with ebird_code, names, base_value |
| `sightings` | Core data: who saw what, where, when, with how many points |
| `rarity_scores` | Pre-computed point values per (species, h3_cell, month) |
| `friendships` | Social graph with pending/accepted/blocked status |
| `patches` | User-defined birding patches (PostGIS polygons) |

## Extensions

- **PostGIS** — geography columns for sightings (POINT) and patches (POLYGON)
- **uuid-ossp** — UUID generation for primary keys

## Running migrations locally

```bash
# Start local Supabase (requires Docker)
supabase start

# Migrations auto-apply on start. To reset:
supabase db reset

# Check status
supabase status
```

## Key functions

- `compute_sighting_points(species_id, h3_cell, month, verification_status)` — returns integer points
- `get_user_tier(total_points)` — returns tier label (novice/beginner/intermediate/advanced/expert/legendary)

## Triggers

- `trg_set_sighting_points` — BEFORE INSERT on sightings, auto-computes points_awarded
- `trg_update_user_total_points` — AFTER INSERT on sightings, increments profiles.total_points

## RLS summary

- **profiles**: read all, update own
- **species**: read all (authenticated), write via service role only
- **sightings**: read own + friends', write own
- **rarity_scores**: read all (authenticated), write via service role only
- **friendships**: read involving self, write involving self
- **patches**: read all, write/update/delete own

## Storage

- `sighting-media` bucket — private, users upload to `{user_id}/...` path prefix

## Seeding

```bash
cd packages/rarity

# 1. Seed species table from eBird taxonomy
python -m scripts.seed_species

# 2. Build rarity scores from eBird Basic Dataset
python -m etl.build_rarity_scores

# 3. Validate scoring matches Phase 1 prototype
python -m scripts.validate_scoring
```
