"""
BirdNET identification server.

Accepts audio file uploads, runs BirdNET v2.4, returns species predictions.

Usage:
    cd services/birdnet
    uv run python server.py

Listens on http://0.0.0.0:8080
"""

import datetime
import os
import subprocess
import tempfile
from pathlib import Path

import birdnet
from flask import Flask, jsonify, request

app = Flask(__name__)

# Models loaded once at startup (not at import time)
_acoustic_model = None
_geo_model = None


def _get_models():
    global _acoustic_model, _geo_model
    if _acoustic_model is None:
        print("Loading acoustic model...")
        _acoustic_model = birdnet.load("acoustic", "2.4", "pb")
        print("Acoustic model ready.")
    if _geo_model is None:
        print("Loading geo model...")
        _geo_model = birdnet.load("geo", "2.4", "pb")
        print("Geo model ready.")
    return _acoustic_model, _geo_model


def _to_wav(src: Path) -> Path | None:
    """Convert audio to WAV using macOS afconvert. Returns None if already WAV."""
    if src.suffix.lower() == ".wav":
        return None
    dst = src.with_suffix(".wav")
    try:
        subprocess.run(
            ["afconvert", "-f", "WAVE", "-d", "LEI16@22050", str(src), str(dst)],
            check=True,
            capture_output=True,
        )
        return dst
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"afconvert failed: {e.stderr.decode(errors='replace')}"
        ) from e
    except FileNotFoundError:
        raise RuntimeError("afconvert not found — this server requires macOS.")


def _week_of_year() -> int:
    """Map today's date to BirdNET's 1-48 week scale."""
    doy = datetime.date.today().timetuple().tm_yday
    return max(1, min(48, (doy * 48) // 365 + 1))


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "BirdNET v2.4"})


@app.route("/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No audio file provided. Send as multipart 'file'."}), 400

    audio_file = request.files["file"]
    try:
        lat = float(request.form.get("lat", 0))
        lon = float(request.form.get("lon", 0))
    except ValueError:
        return jsonify({"error": "lat/lon must be numbers"}), 400

    suffix = Path(audio_file.filename or "audio.m4a").suffix or ".m4a"
    tmp_audio: Path | None = None
    tmp_wav: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_audio = Path(tmp.name)

        # soundfile (used internally by birdnet) can't decode m4a/AAC —
        # convert to WAV using macOS built-in afconvert tool
        tmp_wav = _to_wav(tmp_audio)
        analysis_path = tmp_wav if tmp_wav is not None else tmp_audio

        acoustic, geo = _get_models()

        # Build a location-filtered species list for higher accuracy
        custom_species = None
        if lat != 0 or lon != 0:
            week = _week_of_year()
            geo_result = geo.predict(lat, lon, week=week, min_confidence=0.03)
            expected = geo_result.species_list[~geo_result.species_masked]
            if len(expected) > 0:
                custom_species = list(expected)

        result = acoustic.predict(
            str(analysis_path),
            top_k=10,
            default_confidence_threshold=0.1,
            custom_species_list=custom_species,
        )

        # to_dataframe() columns: input, start_time, end_time, species_name, confidence
        df = result.to_dataframe()

        if df.empty:
            return jsonify({"predictions": []})

        # Aggregate across segments: max confidence per species, return top 5
        best = (
            df.groupby("species_name", as_index=False)["confidence"]
            .max()
            .sort_values("confidence", ascending=False)
            .head(5)
        )

        predictions = []
        for _, row in best.iterrows():
            # species_name format: "Scientific name_Common Name"
            parts = str(row["species_name"]).split("_", 1)
            scientific = parts[0].strip() if len(parts) == 2 else ""
            common = parts[1].strip() if len(parts) == 2 else parts[0].strip()
            predictions.append(
                {
                    "scientific_name": scientific,
                    "common_name": common,
                    "confidence": round(float(row["confidence"]), 4),
                }
            )

        return jsonify({"predictions": predictions})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        for p in (tmp_audio, tmp_wav):
            if p is not None:
                try:
                    p.unlink()
                except OSError:
                    pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print("Preloading models...")
    _get_models()
    print(f"BirdNET server ready on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
