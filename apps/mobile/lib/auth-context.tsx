import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import * as Linking from "expo-linking";

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  isLoading: true,
});

function extractSessionFromUrl(url: string): {
  accessToken: string;
  refreshToken: string;
} | null {
  // Supabase puts tokens in the URL fragment: #access_token=...&refresh_token=...
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;

  const hash = url.substring(hashIndex + 1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (accessToken && refreshToken) {
    return { accessToken, refreshToken };
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    // 1. Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        session,
        user: session?.user ?? null,
        isLoading: false,
      });
    });

    // 2. Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        session,
        user: session?.user ?? null,
        isLoading: false,
      });
    });

    // 3. Handle deep link on cold start
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // 4. Handle deep link while app is open
    const linkingSub = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  async function handleDeepLink(url: string) {
    const tokens = extractSessionFromUrl(url);
    if (tokens) {
      await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
    }
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
