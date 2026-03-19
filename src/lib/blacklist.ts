const BLACKLIST_API_URL = import.meta.env.VITE_BACKEND_API_URL;

let cachedBlacklist: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function fetchBlacklist(): Promise<Set<string>> {
  if (cachedBlacklist && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedBlacklist;
  }

  if (!BLACKLIST_API_URL) {
    return new Set();
  }

  try {
    const res = await fetch(`${BLACKLIST_API_URL}/blacklist`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { transactionIds: string[] } = await res.json();
    cachedBlacklist = new Set(data.transactionIds);
    cacheTimestamp = Date.now();
    return cachedBlacklist;
  } catch (err) {
    console.warn("Failed to fetch blacklist, proceeding without filtering:", err);
    return cachedBlacklist ?? new Set();
  }
}

export async function isBlacklisted(txId: string): Promise<boolean> {
  const blacklist = await fetchBlacklist();
  return blacklist.has(txId);
}
