"""
Validate scoring against the 20 test sightings from Phase 1.

Calls compute_sighting_points() in Supabase via RPC, compares results
to the expected values from the prototype notebook.

Usage:
    python -m scripts.validate_scoring

Requires:
    - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
    - Species table seeded
    - Rarity scores populated (from build_rarity_scores.py or synthetic data)
"""

import os
import sys
from pathlib import Path

import h3
from dotenv import load_dotenv

load_dotenv()

# The same 20 test sightings from the prototype notebook
TEST_SIGHTINGS = [
    ("House Sparrow in Hyde Park, May", "houspa", 51.5073, -0.1657, "2026-05-15", True),
    ("Blackbird in Hyde Park, May", "blabbi", 51.5073, -0.1657, "2026-05-15", True),
    ("Mallard in Hyde Park, May", "mallar", 51.5073, -0.1657, "2026-05-15", True),
    ("Magpie in Hyde Park, May", "magpie", 51.5073, -0.1657, "2026-05-15", True),
    ("Great Spotted Woodpecker in Hyde Park, May", "grechi", 51.5073, -0.1657, "2026-05-15", True),
    ("Sparrowhawk in Hyde Park, May", "eurspa", 51.5073, -0.1657, "2026-05-15", True),
    ("Buzzard in Hyde Park, May", "combuz", 51.5073, -0.1657, "2026-05-15", True),
    ("Peregrine over Hyde Park, May", "perefl", 51.5073, -0.1657, "2026-05-15", True),
    ("Kingfisher at Hyde Park, May", "kinged", 51.5073, -0.1657, "2026-05-15", True),
    ("Hoopoe in Hyde Park, May (!)", "hoopoe", 51.5073, -0.1657, "2026-05-15", True),
    ("Blackbird at Minsmere, May", "blabbi", 52.2388, 1.6180, "2026-05-15", True),
    ("Skylark at Minsmere, May", "skylar", 52.2388, 1.6180, "2026-05-15", True),
    ("Cuckoo at Minsmere, May", "cuckoo", 52.2388, 1.6180, "2026-05-15", True),
    ("Kingfisher at Minsmere, May", "kinged", 52.2388, 1.6180, "2026-05-15", True),
    ("Barn Owl at Minsmere, May", "barnow", 52.2388, 1.6180, "2026-05-15", True),
    ("Hoopoe at Minsmere, May", "hoopoe", 52.2388, 1.6180, "2026-05-15", True),
    ("Waxwing in Cairngorms, Jan", "waxwng", 57.0700, -3.6000, "2026-01-15", True),
    ("Red Kite in Cairngorms, Jan", "redkit", 57.0700, -3.6000, "2026-01-15", True),
    ("Peregrine in Hyde Park, May (UNVERIFIED)", "perefl", 51.5073, -0.1657, "2026-05-15", False),
    ("Whooper Swan at Severn Estuary, Dec", "whoswn", 51.5500, -2.9000, "2026-12-15", True),
]

H3_RESOLUTION = 6


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)

    from supabase import create_client

    supabase = create_client(url, key)

    # Load species code -> id map
    resp = supabase.table("species").select("id,ebird_code,base_value").execute()
    species_lookup = {s["ebird_code"]: s for s in resp.data}

    print(f"{'Description':<45} {'Code':<8} {'H3 Cell':<17} {'Mo':<4} {'Status':<12} {'Points':<8}")
    print("-" * 100)

    results = []
    for desc, code, lat, lng, date, verified in TEST_SIGHTINGS:
        species = species_lookup.get(code)
        if not species:
            print(f"{desc:<45} {code:<8} SPECIES NOT FOUND")
            results.append(None)
            continue

        h3_cell = h3.latlng_to_cell(lat, lng, H3_RESOLUTION)
        month = int(date.split("-")[1])
        verification_status = "auto_verified" if verified else "casual"

        # Call the scoring function via RPC
        resp = supabase.rpc("compute_sighting_points", {
            "p_species_id": species["id"],
            "p_h3_cell": h3_cell,
            "p_month": month,
            "p_verification_status": verification_status,
        }).execute()

        points = resp.data
        results.append(points)
        print(f"{desc:<45} {code:<8} {h3_cell:<17} {month:<4} {verification_status:<12} {points:<8}")

    print("-" * 100)
    valid = [r for r in results if r is not None]
    if valid:
        print(f"\nPoints distribution: min={min(valid)}, max={max(valid)}, "
              f"mean={sum(valid)/len(valid):.1f}")
    print(f"\nTotal sightings scored: {len(valid)}/{len(TEST_SIGHTINGS)}")


if __name__ == "__main__":
    main()
