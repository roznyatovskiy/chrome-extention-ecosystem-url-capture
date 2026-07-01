// ---------------------------------------------------------------------------
// Minimal Supabase REST/Auth client for an MV3 extension popup.
// No external dependencies / no build step — just fetch + chrome.storage.
// Exposes a global `SB` object used by popup.js.
// ---------------------------------------------------------------------------
const SB = (() => {
  const { URL: BASE, ANON_KEY } = window.SUPA;
  const SESSION_KEY = "sb_session";

  // --- session persistence -------------------------------------------------
  async function getSession() {
    const { [SESSION_KEY]: s } = await chrome.storage.local.get(SESSION_KEY);
    return s || null;
  }
  async function setSession(s) {
    await chrome.storage.local.set({ [SESSION_KEY]: s });
  }
  async function clearSession() {
    await chrome.storage.local.remove(SESSION_KEY);
  }

  function stamp(json) {
    // Supabase returns expires_in (seconds); store an absolute expiry (ms).
    return { ...json, expires_at: Date.now() + (json.expires_in ?? 3600) * 1000 };
  }

  // --- auth -----------------------------------------------------------------
  async function signIn(email, password) {
    const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || data.error || "Login failed");
    await setSession(stamp(data));
    return data;
  }

  async function refresh(session) {
    const res = await fetch(`${BASE}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error("Session expired — please log in again");
    const stamped = stamp(data);
    await setSession(stamped);
    return stamped;
  }

  // Returns a valid access token, refreshing if it is about to expire.
  async function getAccessToken() {
    let session = await getSession();
    if (!session) return null;
    if (Date.now() > session.expires_at - 60_000) {
      session = await refresh(session);
    }
    return session.access_token;
  }

  async function signOut() {
    const token = await getSession();
    if (token?.access_token) {
      // Best effort; ignore failures.
      fetch(`${BASE}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${token.access_token}` },
      }).catch(() => {});
    }
    await clearSession();
  }

  function currentUser(session) {
    return session?.user || null;
  }

  // --- data -----------------------------------------------------------------
  // RLS makes this return ONLY the collections the user may access.
  async function listCollections() {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(
      `${BASE}/rest/v1/collections?select=id,slug,name,theme&order=name.asc`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load collections");
    return data;
  }

  // Calls the capture_url RPC; returns { url, results: [{collection_id, status, ...}] }.
  async function captureUrl(url, collectionIds, metadata) {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`${BASE}/rest/v1/rpc/capture_url`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_url: url,
        p_collection_ids: collectionIds,
        p_metadata: metadata || {},
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Capture failed");
    return data;
  }

  return {
    getSession, clearSession, currentUser,
    signIn, signOut, getAccessToken,
    listCollections, captureUrl,
  };
})();
