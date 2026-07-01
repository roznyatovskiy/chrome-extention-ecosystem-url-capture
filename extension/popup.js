// ---------------------------------------------------------------------------
// Popup controller: handles login, loads the user's allowed collections,
// drives the multi-select (recent + search) UI, and fires the capture RPC.
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

let currentUrl = "";
let currentTitle = "";
let allCollections = [];          // [{id, slug, name, theme}] — RLS-filtered
let selected = new Set();          // selected collection ids
let userId = null;
const RECENT_MAX = 5;

// --- views -----------------------------------------------------------------
function showLogin() {
  $("login-view").classList.remove("hidden");
  $("capture-view").classList.add("hidden");
  $("who").classList.add("hidden");
  $("logout").classList.add("hidden");
}
function showCapture(email) {
  $("login-view").classList.add("hidden");
  $("capture-view").classList.remove("hidden");
  $("who").textContent = email || "";
  $("who").classList.remove("hidden");
  $("logout").classList.remove("hidden");
}

function setStatus(el, msg, type) {
  el.textContent = msg;
  el.className = type || "";
}

// --- recents (per user, in chrome.storage.local) ---------------------------
function recentKey() { return `recent_${userId}`; }
async function getRecent() {
  const k = recentKey();
  const { [k]: r } = await chrome.storage.local.get(k);
  return Array.isArray(r) ? r : [];
}
async function pushRecent(ids) {
  const k = recentKey();
  const prev = await getRecent();
  const merged = [...ids, ...prev.filter((id) => !ids.includes(id))].slice(0, 20);
  await chrome.storage.local.set({ [k]: merged });
}

// --- rendering --------------------------------------------------------------
function collById(id) { return allCollections.find((c) => c.id === id); }

function renderSelected() {
  const wrap = $("selected-chips");
  wrap.innerHTML = "";
  $("selected-label").classList.toggle("hidden", selected.size === 0);

  selected.forEach((id) => {
    const c = collById(id);
    if (!c) return;
    const chip = document.createElement("div");
    chip.className = "chip selected";
    chip.innerHTML = `<span>${c.name}</span><span class="x">×</span>`;
    chip.title = "click to remove";
    chip.onclick = () => { selected.delete(id); refresh(); };
    wrap.appendChild(chip);
  });

  $("capture-btn").disabled = selected.size === 0 || !currentUrl;
  $("capture-btn").textContent =
    selected.size === 0 ? "CAPTURE" : `CAPTURE → ${selected.size} COLLECTION${selected.size > 1 ? "S" : ""}`;
}

async function renderSuggestions() {
  const q = $("search").value.trim().toLowerCase();
  const list = $("suggestions");
  list.innerHTML = "";

  let items;
  if (q) {
    $("list-label").textContent = "MATCHES";
    items = allCollections.filter((c) => {
      const hay = `${c.name} ${c.slug} ${c.theme || ""}`.toLowerCase();
      return hay.includes(q);
    });
  } else {
    // No query → show the user's most-recent collections (that are still allowed),
    // falling back to the first few collections if there is no history yet.
    $("list-label").textContent = "RECENT";
    const recent = await getRecent();
    const ordered = recent.map(collById).filter(Boolean);
    const seen = new Set(ordered.map((c) => c.id));
    const fill = allCollections.filter((c) => !seen.has(c.id));
    items = [...ordered, ...fill].slice(0, RECENT_MAX);
  }

  if (items.length === 0) {
    list.innerHTML = `<div class="empty">${
      allCollections.length === 0 ? "no collections available to you" : "no matches"
    }</div>`;
    return;
  }

  items.forEach((c) => {
    const row = document.createElement("div");
    const isSel = selected.has(c.id);
    row.className = "sugg" + (isSel ? " checked" : "");
    row.innerHTML =
      `<span>${c.name}${c.theme ? ` <span class="theme">· ${c.theme}</span>` : ""}</span>` +
      (isSel ? `<span class="tick">✓</span>` : "");
    row.onclick = () => {
      if (selected.has(c.id)) selected.delete(c.id);
      else selected.add(c.id);
      refresh();
    };
    list.appendChild(row);
  });
}

function refresh() {
  renderSelected();
  renderSuggestions();
}

// --- data load --------------------------------------------------------------
async function loadCollections() {
  setStatus($("status"), "loading collections…", "muted");
  try {
    allCollections = await SB.listCollections();
    setStatus($("status"), "", "");
    if (allCollections.length === 0) {
      setStatus($("status"), "You have no collections yet. Ask an admin for access.", "muted");
    }
  } catch (e) {
    setStatus($("status"), "✗ " + e.message, "err");
    allCollections = [];
  }
  refresh();
}

// --- capture ----------------------------------------------------------------
async function doCapture() {
  if (selected.size === 0) return;
  const btn = $("capture-btn");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "SENDING…";

  try {
    const ids = [...selected];
    const out = await SB.captureUrl(currentUrl, ids, {
      title: currentTitle,
      original_url: currentUrl,
    });

    await pushRecent(ids);

    const inserted = out.results.filter((r) => r.status === "inserted").length;
    const exists   = out.results.filter((r) => r.status === "exists");
    const forbidden = out.results.filter((r) => r.status === "forbidden").length;

    let msg = [];
    if (inserted) msg.push(`✓ added to ${inserted} collection${inserted > 1 ? "s" : ""}`);
    if (exists.length) msg.push(`already in ${exists.length} (kept original)`);
    if (forbidden) msg.push(`✗ ${forbidden} not permitted`);
    setStatus($("status"), msg.join(" · ") || "done", forbidden ? "err" : "ok");

    btn.textContent = "✓ DONE";
    setTimeout(() => { refresh(); }, 1600);
  } catch (e) {
    setStatus($("status"), "✗ " + e.message, "err");
    btn.disabled = false;
    btn.textContent = original;
  }
}

// --- login ------------------------------------------------------------------
async function doLogin() {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return setStatus($("login-status"), "Enter email and password", "err");

  const btn = $("login-btn");
  btn.disabled = true;
  btn.textContent = "…";
  try {
    const session = await SB.signIn(email, password);
    userId = session.user.id;
    showCapture(session.user.email);
    await loadCollections();
  } catch (e) {
    setStatus($("login-status"), "✗ " + e.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "LOG IN";
  }
}

// --- boot -------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  // Current tab info.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab?.url || "";
  currentTitle = tab?.title || "";
  $("url-display").textContent = currentUrl || "(no URL)";

  // Wire events.
  $("login-btn").addEventListener("click", doLogin);
  $("password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("logout").addEventListener("click", async () => {
    await SB.signOut();
    selected.clear();
    $("password").value = "";
    showLogin();
  });
  $("search").addEventListener("input", renderSuggestions);
  $("capture-btn").addEventListener("click", doCapture);

  // Restore session if present.
  const session = await SB.getSession();
  if (session) {
    try {
      const token = await SB.getAccessToken(); // refreshes if needed
      if (token) {
        userId = session.user.id;
        showCapture(session.user.email);
        await loadCollections();
        return;
      }
    } catch (_) { /* fall through to login */ }
  }
  showLogin();
});
