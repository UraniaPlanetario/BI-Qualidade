import { useCallback, useEffect, useState } from 'react';

/** Preferências por usuário persistidas em localStorage. */
export interface RecentEntry { path: string; at: string }

const FAV_KEY = (userId: string) => `bi:favorites:${userId}`;
const RECENT_KEY = (userId: string) => `bi:recent:${userId}`;
const RECENT_LIMIT = 8;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded, ignora
  }
}

export function useUserPreferences(userId: string | null | undefined) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      setRecents([]);
      return;
    }
    setFavorites(read<string[]>(FAV_KEY(userId), []));
    setRecents(read<RecentEntry[]>(RECENT_KEY(userId), []));
  }, [userId]);

  const toggleFavorite = useCallback(
    (path: string) => {
      if (!userId) return;
      setFavorites((prev) => {
        const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
        write(FAV_KEY(userId), next);
        return next;
      });
    },
    [userId],
  );

  const isFavorite = useCallback((path: string) => favorites.includes(path), [favorites]);

  const trackVisit = useCallback(
    (path: string) => {
      if (!userId) return;
      setRecents((prev) => {
        const filtered = prev.filter((r) => r.path !== path);
        const next = [{ path, at: new Date().toISOString() }, ...filtered].slice(0, RECENT_LIMIT);
        write(RECENT_KEY(userId), next);
        return next;
      });
    },
    [userId],
  );

  return { favorites, recents, toggleFavorite, isFavorite, trackVisit };
}
