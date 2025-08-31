// =====================
// Config básica
// =====================
const $ = (id) => document.getElementById(id);
const API_BASE = (localStorage.getItem("API_BASE") || location.origin).replace(/\/+$/,'');
$("y") && ($("y").textContent = new Date().getFullYear());

// Guardar/mostrar API en el input (si existe en la página)
(() => {
  const apiInput = $("apiBase");
  if (!apiInput) return;
  const saved = localStorage.getItem("API_BASE");
  if (saved) apiInput.value = saved;
  $("btnGuardar")?.addEventListener("click", () => {
    if (!apiInput.value) return;
    localStorage.setItem("API_BASE", apiInput.value.trim());
    alert("URL de API guardada");
  });
})();

// =====================
// Historial local
// =====================
const HIST_KEY = "SCAN_HISTORY_V1";
const loadHistory   = () => { try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch { return []; } };
const saveHistory   = (arr) => localStorage.setItem(HIST_KEY, JSON.stringify(arr));
function renderHistory(){
  const ul = $("hist"); if (!ul) return;
  const items = loadHistory();
  ul.innerHTML = items.length ? "" : `<li class="muted">(Sin lecturas aún)</li>`;
  for (const it of items.slice().reverse()){
    const li = document.createElement("li");
    li.innerHTML = `<strong>${it.text}</strong><br><small>${it.status} · ${it.hora}</small>`;
    ul.appendChild(li);
  }
}
function appendHistory(entry){
  const items = loadHistory();
  items.push(entry);
  if (items.length > 50) items.splice(0, items.length - 50);
  saveHistory(items);
  renderHistory();
}
$("btnClearHist")?.addEventListener("click", () => { saveHistory([]); renderHistory(); });

// =====================
// Lector QR (html5-qrcode)
// =====================
let qr = null;
let running = false;
let last = "";
let lastAt = 0;

function setMsg(text, isErr=false){
  const m = $("msg"); if (!m) return;
  m.textContent = text || "";
  m.className = "msg" + (isErr ? " err" : " ok");
}

function onScanSuccess(text){
  const now = Date.now();
  if (text === last && now - lastAt < 1500) return; // debounce
  last = text; lastAt = now;

  setMsg("QR leído: " + text);
  navigator.vibrate?.(60);

  // Pausar mientras enviamos para que no machaque el mensaje
  try { qr?.pause?.(true); } catch {}

  // OJO: tu endpoint actual según Swagger es /asistencias/asistencias/scan
  const URL = `${API_BASE}/asistencias/asistencias/scan`;
  console.log("POST", URL);

  fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo_qr: text })
  })
  .then(async r => {
    const raw = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${raw}`);
    const data = raw ? JSON.parse(raw) : {};
    const status = data?.status || "ok";
    const hora   = data?.hora || new Date().toISOString();

    setMsg(`✓ ${status}${data?.alumno ? ` · ${data.alumno}` : ""}`);
    appendHistory({ text, status, hora });
  })
  .catch(e => {
    console.error(e);
    setMsg(String(e), true);
    appendHistory({ text, status: "error_envio", hora: new Date().toISOString() });
  })
  .finally(() => {
    setTimeout(() => { try { qr?.resume?.(); } catch {} }, 1200);
  });
}

async function startScanner(){
  if (running) return;
  const reader = $("reader");
  reader.style.display = "block";

  if (!qr) qr = new Html5Qrcode("reader");

  try{
    await qr.start(
      { facingMode: "environment" },
      {
        fps: 10,
        // Marco siempre centrado y cuadrado (70% del lado menor)
        qrbox: (vw, vh) => {
          const side = Math.floor(Math.min(vw, vh) * 0.7);
          return { width: side, height: side };
        },
        disableFlip: true
      },
      onScanSuccess
    );
    running = true;
    $("btnScan").disabled = true;
    $("btnStop").style.display = "inline-block";
    setMsg("Cámara iniciada");
  }catch(err){
    console.error("No se pudo iniciar cámara:", err);
    setMsg("No se pudo iniciar cámara.", true);
    reader.style.display = "none";
  }
}

async function stopScanner(){
  if (!qr || !running) return;
  try { await qr.stop(); await qr.clear(); } catch {}
  running = false;
  $("reader").style.display = "none";
  $("btnScan").disabled = false;
  $("btnStop").style.display = "none";
  last = ""; lastAt = 0;
  setMsg("Cámara detenida");
}

// Eventos
$("btnScan")?.addEventListener("click", startScanner);
$("btnStop")?.addEventListener("click", stopScanner);
document.addEventListener("visibilitychange", () => { if (document.hidden) stopScanner(); });

// Pintar historial al cargar
renderHistory();
