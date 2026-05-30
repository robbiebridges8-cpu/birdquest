/**
 * BirdNET client — talks to the local BirdNET server.
 *
 * The server runs on your Mac at services/birdnet/server.py.
 * Start it with: cd services/birdnet && uv run python server.py
 */

export interface BirdNetPrediction {
  species_code: string;
  common_name: string;
  scientific_name: string;
  confidence: number;
}

export interface BirdNetResponse {
  predictions: BirdNetPrediction[];
  error?: string;
}

// In dev, the phone hits the Mac's local IP. Update this if your IP changes.
// TODO: move to env var for production
const BIRDNET_SERVER_URL = "http://192.168.0.121:8080/analyze";

export async function analyzeBirdAudio(
  audioUri: string,
  latitude: number,
  longitude: number
): Promise<BirdNetResponse> {
  const formData = new FormData();

  const filename = audioUri.split("/").pop() ?? "recording.m4a";
  formData.append("file", {
    uri: audioUri,
    name: filename,
    type: "audio/mp4",
  } as unknown as Blob);

  formData.append("lat", latitude.toString());
  formData.append("lon", longitude.toString());

  try {
    const response = await fetch(BIRDNET_SERVER_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      return { predictions: [], error: `Server error: ${response.status} - ${text}` };
    }

    const data = await response.json();

    if (data.error) {
      return { predictions: [], error: data.error };
    }

    const predictions: BirdNetPrediction[] = (data.predictions ?? []).map(
      (p: { common_name?: string; scientific_name?: string; confidence?: number }) => ({
        species_code: "",
        common_name: p.common_name ?? "Unknown",
        scientific_name: p.scientific_name ?? "",
        confidence: p.confidence ?? 0,
      })
    );

    return { predictions };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Network request failed")) {
      return {
        predictions: [],
        error: "Can't reach BirdNET server. Make sure server.py is running on your Mac (cd services/birdnet && uv run python server.py)",
      };
    }
    return { predictions: [], error: `BirdNET request failed: ${message}` };
  }
}
