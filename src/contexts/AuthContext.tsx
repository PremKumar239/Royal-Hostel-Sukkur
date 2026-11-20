"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

const TAB_AUTH_KEY = "royal_hostel_tab_auth";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function hasTabAuth(): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem(TAB_AUTH_KEY) === "1";
}

function setTabAuth(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) sessionStorage.setItem(TAB_AUTH_KEY, "1");
  else sessionStorage.removeItem(TAB_AUTH_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(data);
    },
    [supabase]
  );

  useEffect(() => {
    const init = async () => {
      if (!hasTabAuth()) {
        await supabase.auth.signOut({ scope: "local" });
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) await fetchProfile(currentUser.id);
      setLoading(false);
    };
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!hasTabAuth()) {
        setUser(null);
        setProfile(null);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
        return;
      }

      if (event === "SIGNED_OUT") {
        setTabAuth(false);
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) setTabAuth(true);
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    setTabAuth(false);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
