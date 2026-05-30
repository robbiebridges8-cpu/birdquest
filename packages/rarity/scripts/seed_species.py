"""
Seed the species table from the eBird taxonomy CSV and base_values.csv.

Usage:
    python -m scripts.seed_species

Requires:
    - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (or environment)
    - The eBird taxonomy CSV at data/ebird_taxonomy.csv
      Download from: https://www.birds.cornell.edu/clementschecklist/download/
      (requires a free Cornell Lab account)

If the taxonomy file doesn't exist, the script will tell you where to get it.
"""

import csv
import sys
from pathlib import Path

from dotenv import load_dotenv
import os

load_dotenv()

DATA_DIR = Path(__file__).parent.parent / "data"
TAXONOMY_FILE = DATA_DIR / "ebird_taxonomy.csv"
BASE_VALUES_FILE = DATA_DIR / "base_values.csv"


def load_base_values() -> dict[str, int]:
    """Load curated base values by species code."""
    values = {}
    with open(BASE_VALUES_FILE) as f:
        reader = csv.DictReader(f)
        for row in reader:
            values[row["species_code"]] = int(row["base_value"])
    return values


def load_taxonomy(filepath: Path) -> list[dict]:
    """Load eBird taxonomy CSV into a list of species records."""
    records = []
    with open(filepath, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # eBird taxonomy CSV columns vary slightly by version
            # Common columns: SPECIES_CODE, PRIMARY_COM_NAME, SCI_NAME, TAXON_ORDER, CATEGORY
            species_code = row.get("SPECIES_CODE") or row.get("species_code", "")
            common_name = row.get("PRIMARY_COM_NAME") or row.get("primary_com_name", "")
            scientific_name = row.get("SCI_NAME") or row.get("sci_name", "")
            taxon_order = row.get("TAXON_ORDER") or row.get("taxon_order", "")
            category = row.get("CATEGORY") or row.get("category", "species")

            if not species_code or not common_name:
                continue

            records.append({
                "ebird_code": species_code.strip(),
                "common_name": common_name.strip(),
                "scientific_name": scientific_name.strip(),
                "taxonomic_order": float(taxon_order) if taxon_order else None,
                "category": category.strip(),
            })
    return records


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or environment")
        sys.exit(1)

    if not TAXONOMY_FILE.exists():
        print(f"ERROR: Taxonomy file not found at {TAXONOMY_FILE}")
        print()
        print("To get the eBird taxonomy CSV:")
        print("  1. Go to https://www.birds.cornell.edu/clementschecklist/download/")
        print("  2. Download the eBird/Clements checklist CSV")
        print(f"  3. Save it as {TAXONOMY_FILE}")
        sys.exit(1)

    from supabase import create_client

    supabase = create_client(url, key)

    # Load data
    base_values = load_base_values()
    taxonomy = load_taxonomy(TAXONOMY_FILE)
    print(f"Loaded {len(taxonomy)} species from taxonomy")
    print(f"Loaded {len(base_values)} curated base values")

    # Prepare upsert batch
    batch = []
    curated_count = 0
    for record in taxonomy:
        bv = base_values.get(record["ebird_code"])
        if bv is not None:
            record["base_value"] = bv
            curated_count += 1
        else:
            record["base_value"] = 1
        batch.append(record)

    # Upsert in chunks of 500
    chunk_size = 500
    total_upserted = 0
    for i in range(0, len(batch), chunk_size):
        chunk = batch[i : i + chunk_size]
        supabase.table("species").upsert(
            chunk, on_conflict="ebird_code"
        ).execute()
        total_upserted += len(chunk)
        print(f"  Upserted {total_upserted}/{len(batch)}...")

    print()
    print(f"Done! {total_upserted} species upserted.")
    print(f"  {curated_count} got a curated base_value from base_values.csv")
    print(f"  {total_upserted - curated_count} defaulted to base_value=1")


if __name__ == "__main__":
    main()
