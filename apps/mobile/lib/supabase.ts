import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import type { Database } from "@birdquest/shared";

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string;

// expo-secure-store has a 2048-byte limit per key.
// Supabase sessions can exceed this, so we chunk the value across multiple keys.
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const value = await SecureStore.getItemAsync(key);
    if (value) return value;
    // Check for chunked values
    const chunks: string[] = [];
    let i = 0;
    while (true) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (!chunk) break;
      chunks.push(chunk);
      i++;
    }
    return chunks.length > 0 ? chunks.join("") : null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= 2048) {
      await SecureStore.setItemAsync(key, value);
      // Clean up any old chunks
      let i = 0;
      while (true) {
        const chunkKey = `${key}_chunk_${i}`;
        const existing = await SecureStore.getItemAsync(chunkKey);
        if (!existing) break;
        await SecureStore.deleteItemAsync(chunkKey);
        i++;
      }
      return;
    }
    // Store in chunks
    const chunkSize = 2048;
    let i = 0;
    for (let offset = 0; offset < value.length; offset += chunkSize) {
      await SecureStore.setItemAsync(
        `${key}_chunk_${i}`,
        value.slice(offset, offset + chunkSize)
      );
      i++;
    }
    // Remove the non-chunked key if it exists
    try { await SecureStore.deleteItemAsync(key); } catch {}
  },

  removeItem: async (key: string): Promise<void> => {
    try { await SecureStore.deleteItemAsync(key); } catch {}
    let i = 0;
    while (true) {
      const chunkKey = `${key}_chunk_${i}`;
      const existing = await SecureStore.getItemAsync(chunkKey);
      if (!existing) break;
      await SecureStore.deleteItemAsync(chunkKey);
      i++;
    }
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
