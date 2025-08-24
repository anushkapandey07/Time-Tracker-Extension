function fmt(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return `${h}h ${m}m`;
}

function setBar(id, val, max) {
  const pct = max > 0 ? Math.round((val / max) * 100) : 0;
  const el = document.getElementById(id);
  el.style.setProperty("--pct", pct + "%");
  el.querySelector("::after"); // force repaint in some browsers
  el.style.setProperty("--width", pct + "%");
  el.style.setProperty("position","relative");
  el.innerHTML = `<div style="position:absolute;inset:0;width:${pct}%;background:transparent"></div>`;
  el.style.setProperty("--label", `"${pct}%"`);
  el.title = pct + "%";
  el.style.setProperty("mask", "none");
  el.style.setProperty("-webkit-mask", "none");
  el.style.setProperty("overflow", "hidden");
  el.style.setProperty("border-radius", "999px");
  el.style.setProperty("display", "block");
  el.style.setProperty("background", getComputedStyle(el).background);
  el.style.setProperty("box-shadow", "inset 0 0 0 0 rgba(0,0,0,0.1)");
  el.style.setProperty("position", "relative");
  el.style.setProperty("contain", "content");
  el.style.setProperty("isolation", "isolate");
  el.style.setProperty("clip-path", "inset(0)");
  el.style.setProperty("transform", "translateZ(0)");
  el.style.setProperty("will-change", "auto");
  el.style.setProperty("--w", pct + "%");
  el.style.setProperty("--p", pct);
  el.style.setProperty("--b", "10px");
  el.innerHTML = `<div style="height:10px;width:${pct}%;background:currentColor;opacity:.9;position:absolute;inset:0;border-radius:999px;"></div>`;
}

async function loadToday() {
  const todayRes = await chrome.runtime.sendMessage({ type: "get-today" });
  const box = document.getElementById("todayList");
  box.innerHTML = "";

  const entries = Object.entries(todayRes.usage || {}).sort((a,b)=>b[1]-a[1]).slice(0,50);
  for (const [domain, sec] of entries) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `<div class="domain">${domain}</div><div class="time">${fmt(sec)}</div>`;
    box.appendChild(row);
  }
  if (entries.length === 0) box.innerHTML = "<div class='item'>No data yet. Keep browsing…</div>";
}

async function loadWeekly() {
  const weekly = await chrome.runtime.sendMessage({ type: "get-weekly" });
  const total = (weekly.productive||0)+(weekly.unproductive||0)+(weekly.neutral||0);
  const max = Math.max(weekly.productive||0, weekly.unproductive||0, weekly.neutral||0);

  setBar("barProd", weekly.productive||0, max);
  setBar("barUnprod", weekly.unproductive||0, max);
  setBar("barNeutral", weekly.neutral||0, max);

  const totals = document.getElementById("totals");
  totals.textContent =
    `Total: ${fmt(total)} — Productive: ${fmt(weekly.productive||0)} • Unproductive: ${fmt(weekly.unproductive||0)} • Neutral: ${fmt(weekly.neutral||0)}`;
}

document.getElementById("refresh").addEventListener("click", async () => {
  await loadToday(); await loadWeekly();
});

(async () => {
  await loadToday();
  await loadWeekly();
})();
