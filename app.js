const state = {
  files: [],
  dataUrls: [],
  result: null,
  selectedMusic: null,
  selectedCaption: null,
  audio: null
};

const $ = (id) => document.getElementById(id);
const input = $("photoInput");
const dropZone = $("dropZone");
const previewSection = $("previewSection");
const previewGrid = $("previewGrid");
const analyzeBtn = $("analyzeBtn");
const loadingState = $("loadingState");
const results = $("results");
const errorBox = $("errorBox");

$("chooseBtn").addEventListener("click", () => input.click());
input.addEventListener("change", (e) => addFiles([...e.target.files]));
$("clearBtn").addEventListener("click", resetStudio);
$("newAnalysisBtn").addEventListener("click", resetStudio);
$("analyzeBtn").addEventListener("click", analyze);
$("generatePosesBtn").addEventListener("click", generatePoseVersions);
$("approveBtn").addEventListener("click", () => {
  $("approvedState").classList.remove("hidden");
  $("approveBtn").textContent = "✓ Approved";
  $("approveBtn").disabled = true;
});

["dragenter","dragover"].forEach(evt => dropZone.addEventListener(evt, e => {
  e.preventDefault(); dropZone.classList.add("drag");
}));
["dragleave","drop"].forEach(evt => dropZone.addEventListener(evt, e => {
  e.preventDefault(); dropZone.classList.remove("drag");
}));
dropZone.addEventListener("drop", e => addFiles([...e.dataTransfer.files]));

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}
function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function addFiles(newFiles) {
  clearError();
  const images = newFiles.filter(f => /^image\/(jpeg|png|webp)$/i.test(f.type));
  if (!images.length) return showError("Please choose JPG, PNG or WebP images.");
  const combined = [...state.files, ...images];
  state.files = combined.slice(0, 3);
  if (combined.length > 3) showError("GMLiva works with 2–3 photos. The first 3 selected photos were kept.");
  renderPreviews();
}

function renderPreviews() {
  previewGrid.innerHTML = "";
  state.files.forEach((file, index) => {
    const card = document.createElement("div");
    card.className = "preview-card";
    const img = document.createElement("img");
    img.alt = `Uploaded photo ${index + 1}`;
    img.src = URL.createObjectURL(file);
    const label = document.createElement("span");
    label.className = "preview-label";
    label.textContent = `Photo ${index + 1}`;
    const remove = document.createElement("button");
    remove.className = "remove-photo";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove photo ${index + 1}`);
    remove.addEventListener("click", () => {
      state.files.splice(index, 1);
      renderPreviews();
    });
    card.append(img, label, remove);
    previewGrid.appendChild(card);
  });
  previewSection.classList.toggle("hidden", state.files.length === 0);
  analyzeBtn.disabled = state.files.length < 2 || state.files.length > 3;
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const max = 1024;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

async function analyze() {
  if (state.files.length < 2 || state.files.length > 3) return;
  clearError();
  analyzeBtn.disabled = true;
  loadingState.classList.remove("hidden");
  results.classList.add("hidden");

  try {
    state.dataUrls = await Promise.all(state.files.map(compressImage));
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: state.dataUrls })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Analysis failed.");
    state.result = data;
    renderResults(data);
    loadingState.classList.add("hidden");
    results.classList.remove("hidden");
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    loadingState.classList.add("hidden");
    showError(err.message || "Something went wrong. Please try again.");
  } finally {
    analyzeBtn.disabled = state.files.length < 2;
  }
}

function renderResults(r) {
  const best = Math.max(1, Math.min(r.bestPhotoNumber, state.dataUrls.length));
  $("bestPhoto").src = state.dataUrls[best - 1];
  $("bestTitle").textContent = `Photo ${best}`;
  $("bestReason").textContent = r.bestPhotoReason;

  $("analysisScores").innerHTML = r.analyses.map(a =>
    `<span class="score-chip">Photo ${a.photoNumber}<strong>${a.score}/100</strong></span>`
  ).join("");

  $("poseList").className = "pose-grid";
  $("poseList").innerHTML = r.poseIdeas.map((p, i) =>
    `<div class="pose-item"><b>${i + 1}. ${escapeHtml(p.title)}</b><p>${escapeHtml(p.direction)}</p><small>${escapeHtml(p.naturalTip)}</small></div>`
  ).join("");
  $("poseStatus").classList.add("hidden");
  $("generatePosesBtn").disabled = false;
  $("generatePosesBtn").textContent = "Generate 5 pose versions ✦";

  $("aestheticList").innerHTML = r.aesthetics.map(a =>
    `<div class="aesthetic"><b>${escapeHtml(a.name)}</b><p>${escapeHtml(a.setting)} · ${escapeHtml(a.light)} · ${escapeHtml(a.mood)}</p></div>`
  ).join("");

  const p = r.postPackage;
  $("postPackage").innerHTML = `
    <div class="post-box">
      <p class="main-caption" data-caption="${escapeHtml(p.caption)}">${escapeHtml(p.caption)}</p><button type="button" class="action-btn copy-caption">Copy main caption</button>
      <div class="mini-heading">Alternatives</div>
      <div class="text-items">${p.alternatives.map(x => `<span class="text-pill">${escapeHtml(x)}</span>`).join("")}</div>
      <div class="mini-heading">Music</div>
      <div class="text-items">${p.music.map(x => `<span class="text-pill">${escapeHtml(x)}</span>`).join("")}</div>
      <div class="mini-heading">Hashtags</div>
      <div class="text-items">${p.hashtags.map(x => `<span class="text-pill">${escapeHtml(x)}</span>`).join("")}</div>
      <div class="mini-heading">Posting suggestion</div>
      <div style="font-size:10px;color:#697367">${escapeHtml(p.postingSuggestion)}</div>
    </div>`;

  $("storyList").innerHTML = r.storyPlan.map(s =>
    `<div class="story-item"><b>${escapeHtml(s.slide)} · ${escapeHtml(s.visual)}</b><p>${escapeHtml(s.text)} · ${escapeHtml(s.music)}</p></div>`
  ).join("");

  $("collageList").innerHTML = r.collageLayouts.map((x, i) =>
    `<div class="collage-item"><b>${i + 1}.</b> ${escapeHtml(x)}</div>`
  ).join("");

  $("highlightList").innerHTML = r.highlights.map(x => `<span>${escapeHtml(x)}</span>`).join("");
  $("musicList").innerHTML = r.postPackage.music.map((x, i) => {
    const query = encodeURIComponent(`${x} official audio`);
    return `<div class="music-item music-card" data-music="${escapeHtml(x)}"><div class="music-copy"><strong>♪ ${escapeHtml(x)}</strong><small>Listen to the actual track on YouTube</small></div><div class="music-actions"><a class="music-play" href="https://www.youtube.com/results?search_query=${query}" target="_blank" rel="noopener">▶ Play actual music</a><button type="button" class="music-select" data-music="${escapeHtml(x)}">Select</button></div></div>`;
  }).join("");
  document.querySelectorAll(".music-select").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMusic = button.dataset.music;
      document.querySelectorAll(".music-item").forEach((b) => b.classList.remove("selected"));
      const card = button.closest(".music-item");
      card.classList.add("selected");
      document.querySelectorAll(".music-select").forEach((b) => b.textContent = "Select");
      button.textContent = "✓ Selected";
    });
  });

  document.querySelectorAll(".text-pill").forEach(el => {
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.addEventListener("click", () => { el.classList.toggle("selected"); });
  });
  const copyBtn = document.querySelector(".copy-caption");
  if (copyBtn) copyBtn.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(p.caption);
    copyBtn.textContent = "✓ Caption copied";
  });
  document.querySelectorAll(".story-item, .collage-item, .highlightList span").forEach(el => el.addEventListener("click", () => el.classList.toggle("selected")));

  $("plannerList").innerHTML = r.planner.map(x =>
    `<div class="planner-item"><b>${escapeHtml(x.type)}</b><p>${escapeHtml(x.idea)}</p><p><strong>${escapeHtml(x.timing)}</strong></p></div>`
  ).join("");

  $("approvedState").classList.add("hidden");
  $("approveBtn").textContent = "Approve this package ✓";
  $("approveBtn").disabled = false;
}


async function generatePoseVersions() {
  if (!state.dataUrls.length || !state.result) return;
  clearError();
  const btn = $("generatePosesBtn");
  const status = $("poseStatus");
  const list = $("poseList");
  btn.disabled = true;
  btn.textContent = "Generating…";
  status.classList.remove("hidden");
  status.textContent = "Creating 5 actual edited pose versions. This can take a little time.";
  list.className = "pose-grid actual";
  list.innerHTML = "";

  const best = Math.max(1, Math.min(state.result.bestPhotoNumber, state.dataUrls.length));
  const source = state.dataUrls[best - 1];
  const ideas = state.result.poseIdeas.slice(0, 5);

  try {
    for (let i = 0; i < ideas.length; i++) {
      status.textContent = `Creating pose ${i + 1} of ${ideas.length}…`;
      const response = await fetch("/api/pose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: source,
          pose: ideas[i].direction,
          title: ideas[i].title
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Pose ${i + 1} failed.`);
      const card = document.createElement("div");
      card.className = "pose-option";
      card.innerHTML = `
        <img src="${data.image}" alt="${escapeHtml(ideas[i].title)}">
        <div class="pose-meta"><h5>${i + 1}. ${escapeHtml(ideas[i].title)}</h5>
        <p>${escapeHtml(ideas[i].direction)}</p></div>`;
      list.appendChild(card);
    }
    status.textContent = "✓ Five actual pose versions are ready. Choose the one you like.";
    btn.textContent = "Regenerate 5 pose versions ✦";
  } catch (err) {
    status.textContent = "";
    status.classList.add("hidden");
    showError(err.message || "Pose generation failed. Please try again.");
    btn.textContent = "Generate 5 pose versions ✦";
  } finally {
    btn.disabled = false;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

function resetStudio() {
  state.files = [];
  state.dataUrls = [];
  state.result = null;
  state.selectedMusic = null;
  state.selectedCaption = null;
  if (state.audio) { state.audio.pause(); state.audio = null; }
  input.value = "";
  previewGrid.innerHTML = "";
  previewSection.classList.add("hidden");
  loadingState.classList.add("hidden");
  results.classList.add("hidden");
  $("approvedState").classList.add("hidden");
  $("approveBtn").textContent = "Approve this package ✓";
  $("approveBtn").disabled = false;
  clearError();
  window.scrollTo({ top: $("studio").offsetTop - 80, behavior: "smooth" });
}
