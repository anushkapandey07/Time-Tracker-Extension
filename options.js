const toText = arr => (arr || []).join("\n");
const toArray = txt => txt.split("\n").map(s=>s.trim()).filter(Boolean);

async function load() {
  const res = await chrome.runtime.sendMessage({ type: "get-categories" });
  document.getElementById("prod").value = toText(res.productive);
  document.getElementById("unprod").value = toText(res.unproductive);
}
load();

document.getElementById("save").addEventListener("click", async () => {
  const categoryList = {
    productive: toArray(document.getElementById("prod").value),
    unproductive: toArray(document.getElementById("unprod").value)
  };
  await chrome.runtime.sendMessage({ type: "set-categories", categoryList });
  const msg = document.getElementById("msg");
  msg.textContent = "Saved!";
  setTimeout(()=> msg.textContent = "", 1500);
});
