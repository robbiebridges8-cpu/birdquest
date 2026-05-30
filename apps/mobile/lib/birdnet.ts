/**
 * BirdNET API client.
 *
 * Uses the public BirdNET Analyzer API hosted by Cornell Lab.
 * Endpoint: https://api.birdnet.cornell.edu/v1/analyze
 *
 * Accepts audio files (WAV, MP3, FLAC, OGG) up to 15 seconds.
 * Returns species predictions with confidence scores.
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

const BIRDNET_API_URL = "https://api.birdnet.cornell.edu/v1/analyze";

export async function analyzeBirdAudio(
  audioUri: string,
  latitude: number,
  longitude: number
): Promise<BirdNetResponse> {
  const formData = new FormData();

  // Expo audio records as .m4a — BirdNET accepts this
  const filename = audioUri.split("/").pop() ?? "recording.m4a";
  formData.append("file", {
    uri: audioUri,
    name: filename,
    type: "audio/mp4",
  } as unknown as Blob);

  formData.append("lat", latitude.toString());
  formData.append("lon", longitude.toString());
  // Restrict to likely species for the location/time
  formData.append("min_conf", "0.1");

  const response = await fetch(BIRDNET_API_URL, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    return { predictions: [], error: `BirdNET API error: ${response.status} - ${text}` };
  }

  const data = await response.json();

  // BirdNET response format: { predictions: [{ species, confidence }] }
  // Normalize to our format
  if (Array.isArray(data)) {
    // Some versions return array directly
    const predictions: BirdNetPrediction[] = data.map((item: Record<string, unknown>) => ({
      species_code: (item.species_code as string) ?? "",
      common_name: (item.common_name as string) ?? (item.name as string) ?? "",
      scientific_name: (item.scientific_name as string) ?? "",
      confidence: (item.confidence as number) ?? 0,
    }));
    return { predictions };
  }

  if (data.predictions) {
    return { predictions: data.predictions };
  }

  // Handle alternate response shapes
  if (data.results) {
    const predictions: BirdNetPrediction[] = Object.entries(
      data.results as Record<string, Record<string, number>>
    ).flatMap(([_timeRange, species]) =>
      Object.entries(species).map(([name, confidence]) => {
        const [scientific, common] = name.split("_");
        return {
          species_code: "",
          common_name: common ?? name,
          scientific_name: scientific ?? "",
          confidence: confidence as number,
        };
      })
    );
    predictions.sort((a, b) => b.confidence - a.confidence);
    return { predictions };
  }

  return { predictions: [], error: "Unexpected response format" };
}
