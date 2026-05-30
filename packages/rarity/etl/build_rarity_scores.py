"""
Build rarity scores from the eBird Basic Dataset and upsert to Supabase.

Usage:
    python -m etl.build_rarity_scores

Requires:
    - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (or environment)
    - eBird Basic Dataset GB file at data/ebd_GB_relMay-2026.txt.gz
    - Species table already seeded (run scripts/seed_species.py first)

This reads the eBird data, computes (h3_cell, month, species) frequencies,
applies H3 resolution fallback for sparse cells, computes point_value from
base_value * local_multiplier, and upserts results to rarity_scores.
"""

import os
import sys
from pathlib import Path

import h3
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path(__file__).parent.parent / "data"
EBD_FILE = DATA_DIR / "ebd_GB_relMay-2026.txt.gz"
H3_RESOLUTION = 6
MIN_CHECKLISTS_THRESHOLD = 50

COLS_TO_LOAD = [
    "SPECIES CODE",
    "OBSERVATION DATE",
    "LATITUDE",
    "LONGITUDE",
    "SAMPLING EVENT IDENTIFIER",
]


def get_expectation_multiplier(frequency: float | None) -> float:
    """Map checklist frequency to a scoring multiplier."""
    if frequency is None or frequency == 0:
        return 50.0
    elif frequency < 0.001:
        return 25.0
    elif frequency < 0.01:
        return 10.0
    elif frequency < 0.10:
        return 3.0
    elif frequency < 0.50:
        return 1.0
    else:
        return 0.5


def load_ebd(filepath: Path) -> pd.DataFrame:
    """Load eBird Basic Dataset, keeping only needed columns."""
    print(f"Loading eBird data from {filepath}...")
    chunks = []
    reader = pd.read_csv(
        filepath,
        sep="\t",
        usecols=COLS_TO_LOAD,
        dtype={"SPECIES CODE": str, "SAMPLING EVENT IDENTIFIER": str},
        parse_dates=["OBSERVATION DATE"],
        compression="gzip",
        chunksize=500_000,
        low_memory=False,
    )
    for i, chunk in enumerate(reader):
        chunk = chunk.dropna(subset=["LATITUDE", "LONGITUDE"])
        chunks.append(chunk)
        print(f"  Chunk {i + 1}: {len(chunk):,} rows")

    df = pd.concat(chunks, ignore_index=True)
    print(f"Total rows: {len(df):,}")
    return df


def compute_frequencies(df: pd.DataFrame) -> pd.DataFrame:
    """Compute species frequency per (h3_cell, month) at resolution 6."""
    print("Computing H3 cells...")
    df["h3_cell"] = [
        h3.latlng_to_cell(lat, lng, H3_RESOLUTION)
        for lat, lng in zip(df["LATITUDE"], df["LONGITUDE"])
    ]
    df["month"] = df["OBSERVATION DATE"].dt.month

    print("Computing frequency tables...")
    total_checklists = (
        df.groupby(["h3_cell", "month"])["SAMPLING EVENT IDENTIFIER"]
        .nunique()
        .rename("total_checklists")
        .reset_index()
    )

    species_checklists = (
        df.groupby(["h3_cell", "month", "SPECIES CODE"])["SAMPLING EVENT IDENTIFIER"]
        .nunique()
        .rename("species_checklists")
        .reset_index()
    )

    freq = species_checklists.merge(total_checklists, on=["h3_cell", "month"])
    freq["frequency"] = freq["species_checklists"] / freq["total_checklists"]

    return freq


def apply_h3_fallback(freq: pd.DataFrame) -> pd.DataFrame:
    """
    For cells with insufficient data at res 6, aggregate to res 5 or 4.
    Returns a DataFrame with columns:
        species_code, h3_cell, h3_resolution, month, frequency, total_checklists
    """
    results = []

    # Resolution 6: keep cells with enough data
    res6 = freq[freq["total_checklists"] >= MIN_CHECKLISTS_THRESHOLD].copy()
    res6["h3_resolution"] = 6
    results.append(res6[["SPECIES CODE", "h3_cell", "h3_resolution", "month", "frequency", "total_checklists"]])
    print(f"  Res 6: {len(res6):,} rows (>= {MIN_CHECKLISTS_THRESHOLD} checklists)")

    # Find sparse cells
    sparse = freq[freq["total_checklists"] < MIN_CHECKLISTS_THRESHOLD].copy()
    if sparse.empty:
        return pd.concat(results, ignore_index=True)

    # Resolution 5 fallback
    sparse["h3_parent_5"] = sparse["h3_cell"].apply(lambda c: h3.cell_to_parent(c, 5))
    parent5_total = sparse.groupby(["h3_parent_5", "month"]).agg(
        total_checklists=("total_checklists", "sum")
    ).reset_index()

    parent5_species = sparse.groupby(["h3_parent_5", "month", "SPECIES CODE"]).agg(
        species_checklists=("species_checklists", "sum"),
        total_checklists=("total_checklists", "sum"),
    ).reset_index()
    parent5_species["frequency"] = parent5_species["species_checklists"] / parent5_species["total_checklists"]

    # Keep res5 cells with enough data
    res5_enough = parent5_species[parent5_species["total_checklists"] >= MIN_CHECKLISTS_THRESHOLD].copy()
    res5_enough["h3_cell"] = res5_enough["h3_parent_5"]
    res5_enough["h3_resolution"] = 5
    results.append(res5_enough[["SPECIES CODE", "h3_cell", "h3_resolution", "month", "frequency", "total_checklists"]])
    print(f"  Res 5: {len(res5_enough):,} rows (fallback)")

    # Resolution 4 fallback for still-sparse cells
    still_sparse = parent5_species[parent5_species["total_checklists"] < MIN_CHECKLISTS_THRESHOLD].copy()
    if not still_sparse.empty:
        still_sparse["h3_parent_4"] = still_sparse["h3_parent_5"].apply(lambda c: h3.cell_to_parent(c, 4))
        parent4_species = still_sparse.groupby(["h3_parent_4", "month", "SPECIES CODE"]).agg(
            species_checklists=("species_checklists", "sum"),
            total_checklists=("total_checklists", "sum"),
        ).reset_index()
        parent4_species["frequency"] = parent4_species["species_checklists"] / parent4_species["total_checklists"]

        res4 = parent4_species[parent4_species["total_checklists"] >= MIN_CHECKLISTS_THRESHOLD].copy()
        res4["h3_cell"] = res4["h3_parent_4"]
        res4["h3_resolution"] = 4
        results.append(res4[["SPECIES CODE", "h3_cell", "h3_resolution", "month", "frequency", "total_checklists"]])
        print(f"  Res 4: {len(res4):,} rows (fallback)")

    return pd.concat(results, ignore_index=True)


def compute_point_values(
    freq_df: pd.DataFrame, base_value_map: dict[str, int]
) -> pd.DataFrame:
    """Compute point_value = base_value * local_multiplier for each row."""
    freq_df = freq_df.copy()
    freq_df["base_value"] = freq_df["SPECIES CODE"].map(base_value_map).fillna(1).astype(int)
    freq_df["local_multiplier"] = freq_df["frequency"].apply(get_expectation_multiplier)
    freq_df["point_value"] = (freq_df["base_value"] * freq_df["local_multiplier"]).round().astype(int)
    return freq_df


def load_species_map(supabase) -> dict[str, str]:
    """Load ebird_code -> species UUID map from Supabase."""
    print("Loading species map from Supabase...")
    all_species = []
    offset = 0
    while True:
        resp = supabase.table("species").select("id,ebird_code").range(offset, offset + 999).execute()
        if not resp.data:
            break
        all_species.extend(resp.data)
        if len(resp.data) < 1000:
            break
        offset += 1000
    return {s["ebird_code"]: s["id"] for s in all_species}


def load_base_values() -> dict[str, int]:
    """Load base values from CSV."""
    import csv
    values = {}
    bv_file = DATA_DIR / "base_values.csv"
    with open(bv_file) as f:
        reader = csv.DictReader(f)
        for row in reader:
            values[row["species_code"]] = int(row["base_value"])
    return values


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)

    if not EBD_FILE.exists():
        print(f"ERROR: eBird data file not found at {EBD_FILE}")
        print("Download the GB subset from https://ebird.org/data/download")
        sys.exit(1)

    from supabase import create_client

    supabase = create_client(url, key)

    # Load species UUID map
    species_map = load_species_map(supabase)
    if not species_map:
        print("ERROR: Species table is empty. Run seed_species.py first.")
        sys.exit(1)
    print(f"  {len(species_map)} species in database")

    # Load and process eBird data
    ebd = load_ebd(EBD_FILE)
    freq = compute_frequencies(ebd)
    freq_with_fallback = apply_h3_fallback(freq)

    # Compute point values
    base_values = load_base_values()
    scored = compute_point_values(freq_with_fallback, base_values)

    # Map species codes to UUIDs
    scored["species_id"] = scored["SPECIES CODE"].map(species_map)
    # Drop species not in our DB
    before = len(scored)
    scored = scored.dropna(subset=["species_id"])
    print(f"\nDropped {before - len(scored)} rows for species not in DB")

    # Prepare upsert records
    records = scored[["species_id", "h3_cell", "h3_resolution", "month", "frequency", "point_value"]].copy()
    records["updated_at"] = pd.Timestamp.now(tz="UTC").isoformat()
    records["frequency"] = records["frequency"].round(6)
    records = records.to_dict("records")

    # Upsert in chunks
    chunk_size = 1000
    total = 0
    for i in range(0, len(records), chunk_size):
        chunk = records[i : i + chunk_size]
        supabase.table("rarity_scores").upsert(
            chunk, on_conflict="species_id,h3_cell,h3_resolution,month"
        ).execute()
        total += len(chunk)
        if total % 10000 == 0 or total == len(records):
            print(f"  Upserted {total}/{len(records)}...")

    # Print summary
    print("\n=== ETL Summary ===")
    print(f"Total rows written: {len(records):,}")
    print(f"\nPoint value distribution:")
    pv = scored["point_value"]
    print(f"  Min:    {pv.min()}")
    print(f"  Max:    {pv.max()}")
    print(f"  Mean:   {pv.mean():.1f}")
    print(f"  Median: {pv.median():.1f}")
    print(f"\nResolution breakdown:")
    print(scored.groupby("h3_resolution").size().to_string())
    print(f"\nUnique species: {scored['SPECIES CODE'].nunique()}")
    print(f"Unique H3 cells: {scored['h3_cell'].nunique()}")


if __name__ == "__main__":
    main()
