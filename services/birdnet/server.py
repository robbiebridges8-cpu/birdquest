"""
BirdNET identification server.

Accepts audio file uploads, runs BirdNET v2.4, returns species predictions.

Usage:
    cd services/birdnet
    uv run python server.py

Listens on http://0.0.0.0:8080
"""

import json
import tempfile
import os
from pathlib import Path
from flask import Flask, request, jsonify
from birdnet import load

app = Flask(__name__)

print("Loading BirdNET model...")
model = load("acoustic", "2.4", "tf")
print("Model ready.")


@app.route("/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No audio file provided. Send as multipart 'file'."}), 400

    audio_file = request.files["file"]
    lat = request.form.get("lat", type=float)
    lon = request.form.get("lon", type=float)

    # Save uploaded audio to a temp file
    suffix = Path(audio_file.filename or "audio.m4a").suffix or ".m4a"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio_file.save(tmp)
        tmp_path = tmp.name

    try:
        result = model.predict(tmp_path, top_k=5)

        predictions = []
        for file_result in result:
            for segment in file_result:
                for species_name, confidence in segment:
                    # species_name format: "Scientific name_Common name"
                    parts = species_name.split("_", 1)
                    scientific = parts[0] if len(parts) > 0 else ""
                    common = parts[1] if len(parts) > 1 else species_name
                    predictions.append({
                        "common_name": common,
                        "scientific_name": scientific,
                        "confidence": round(float(confidence), 4),
                    })

        # Deduplicate by common_name, keep highest confidence
        seen = {}
        for pred in predictions:
            name = pred["common_name"]
            if name not in seen or pred["confidence"] > seen[name]["confidence"]:
                seen[name] = pred
        predictions = sorted(seen.values(), key=lambda x: x["confidence"], reverse=True)

        return jsonify({"predictions": predictions[:10]})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        os.unlink(tmp_path)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "BirdNET v2.4"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=False)
