import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

/**
 * Global Notifications Context
 *
 * A single source of truth for the unread notification count across
 * the whole app. Any bell/badge rendered anywhere shares the same value
 * so a mark-read from one screen instantly updates every visible bell.
 *
 * - Polls unread-count every 15s while user is logged in.
 * - Also refreshes on AppState "active" (screen wake / app resume).
 * - Exposes `refresh()` for imperative refresh after events
 *   (e.g. after opening the inbox / marking read).
 * - Provides `setUnread(n)` for optimistic UI updates.
 */

type Ctx = {
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  setUnread: (n: number | ((prev: number) => number)) => void;
};

const NotificationsCtx = createContext<Ctx>({
  unread: 0,
  loading: false,
  refresh: async () => {},
  setUnread: () => {},
});

const POLL_MS = 15000; // 15s

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unread, setUnreadState] = useState(0);
  const [loading, setLoading] = useState(false);
  const timer = useRef<any>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadState(0);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const r: any = await api.notificationsUnreadCount();
      setUnreadState(Number(r?.count || 0));
    } catch {
      // silent — keep previous value
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [user]);

  // Polling while a user is logged in
  useEffect(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    if (!user) {
      setUnreadState(0);
      return;
    }
    // Immediate load
    refresh();
    // Poll
    timer.current = setInterval(refresh, POLL_MS);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [user, refresh]);

  // AppState → refresh on foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const setUnread = useCallback((n: number | ((prev: number) => number)) => {
    if (typeof n === "function") {
      setUnreadState((prev) => Math.max(0, (n as any)(prev)));
    } else {
      setUnreadState(Math.max(0, n));
    }
  }, []);

  const value = useMemo(
    () => ({ unread, loading, refresh, setUnread }),
    [unread, loading, refresh, setUnread]
  );

  return <NotificationsCtx.Provider value={value}>{children}</NotificationsCtx.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsCtx);
}
