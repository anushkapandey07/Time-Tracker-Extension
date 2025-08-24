// ===== CONFIG =====
const POLL_SECONDS = 5;
const BACKEND_URL = ""; // e.g., "https://your-backend.example.com" (leave empty to disable)
const DEFAULT_PRODUCTIVE = [
  "leetcode.com","geeksforgeeks.org","codeforces.com","github.com",
  "stackOverflow.com","kaggle.com","codechef.com","coursera.org",
  "udemy.com","w3schools.com","developer.mozilla.org","docs.python.org"
];
const DEFAULT_UNPRODUCTIVE = ["instagram.com","facebook.com","twitter.com","x.com","tiktok.com","reddit.com","youtube.com","netflix.com"];

const storage = chrome.storage.local;

// Initialize defaults once
async function ensureDefaults() {
  const { categoriesInitialized } = await storage.get("categoriesInitialized");
  if (!categoriesInitialized) {
    await storage.set({
      categoriesInitialized: true,
      categoryList: {
        productive: DEFAULT_PRODUCTIVE,
        unproductive: DEFAULT_UNPRODUCTIVE
      }
    });
  }
}
ensureDefaults();

// Domain helper
function getDomainFromUrl(url) {
  try {
    const u = new URL(url);
    return (u.hostname || "").replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

// Date key helper (YYYY-MM-DD)
function dayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

// Classification
async function classifyDomain(domain) {
  const { categoryList = { productive: [], unproductive: [] } } = await storage.get("categoryList");
  if (categoryList.productive.some(d => domain.endsWith(d))) return "productive";
  if (categoryList.unproductive.some(d => domain.endsWith(d))) return "unproductive";
  return "neutral";
}

// Track state in memory
let current = { tabId: null, windowId: null, domain: "", lastTs: Date.now(), isWindowFocused: true };

// Update active tab/domain
async function refreshActiveContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) return;
    const domain = getDomainFromUrl(tab.url || "");
    current = { ...current, tabId: tab.id, windowId: tab.windowId, domain };
  } catch {}
}
refreshActiveContext();

// When active tab changes / updated / window focus
chrome.tabs.onActivated.addListener(refreshActiveContext);
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab.active && info.status === "complete") refreshActiveContext();
});
chrome.windows.onFocusChanged.addListener(async (winId) => {
  current.isWindowFocused = winId !== chrome.windows.WINDOW_ID_NONE;
  if (current.isWindowFocused) await refreshActiveContext();
});

// Core: add elapsed seconds to domain for today
async function tick() {
  const now = Date.now();
  const delta = Math.round((now - current.lastTs) / 1000);
  current.lastTs = now;

  if (!current.isWindowFocused) return;
  if (!current.domain) return;

  const today = dayKey();
  const key = `usage:${today}`;
  const { [key]: usage = {} } = await storage.get(key);

  usage[current.domain] = (usage[current.domain] || 0) + delta;
  await storage.set({ [key]: usage });

  // rolling weekly cache
  await updateWeeklyCache();
}
chrome.alarms.create("tick", { periodInMinutes: POLL_SECONDS / 60 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === "tick") tick(); });

// Build weekly summary (last 7 days)
async function getWeekKeys() {
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(`usage:${d.toISOString().slice(0, 10)}`);
  }
  return keys;
}

async function updateWeeklyCache() {
  const keys = await getWeekKeys();
  const items = await storage.get(keys);
  const all = {};
  keys.forEach(k => {
    const day = (items[k] || {});
    for (const [domain, sec] of Object.entries(day)) {
      all[domain] = (all[domain] || 0) + sec;
    }
  });

  // Group by category
  const grouped = { productive: 0, unproductive: 0, neutral: 0, domains: {} };
  for (const [domain, sec] of Object.entries(all)) {
    const cat = await classifyDomain(domain);
    grouped[cat] += sec;
    grouped.domains[domain] = { seconds: sec, category: cat };
  }
  await storage.set({ weeklySummary: grouped });

  // Optional sync with backend
  if (BACKEND_URL) {
    try {
      fetch(`${BACKEND_URL}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: grouped, period: "last7" })
      }).catch(()=>{});
    } catch {}
  }
}

// Handle popup requests
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "get-today") {
      const key = `usage:${dayKey()}`;
      const { [key]: usage = {} } = await storage.get(key);
      sendResponse({ usage });
    } else if (msg.type === "get-weekly") {
      const { weeklySummary = { productive:0, unproductive:0, neutral:0, domains:{} } } = await storage.get("weeklySummary");
      sendResponse(weeklySummary);
    } else if (msg.type === "set-categories") {
      await storage.set({ categoryList: msg.categoryList });
      await updateWeeklyCache();
      sendResponse({ ok: true });
    } else if (msg.type === "get-categories") {
      const { categoryList = { productive: [], unproductive: [] } } = await storage.get("categoryList");
      sendResponse(categoryList);
    } else {
      sendResponse({ error: "unknown" });
    }
  })();
  return true; // async
});
