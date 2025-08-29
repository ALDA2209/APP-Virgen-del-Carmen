// =====================
// Config
// =====================
const DEFAULT_API = location.origin;
const API = localStorage.getItem("API_BASE") || DEFAULT_API;

const $ = (id) => document.getElementById(id);
$("y") && ($("y").textContent = new Date().getFullYear());

function toast(t, kind = "ok", ms = 4500) {
  const m = $("msg"); if (!m) return;
  m.textContent = t || "";
  m.className = "msg " + (kind === "err" ? "err" : "ok");
  if (t) setTimeout(() => { m.textContent = ""; m.className = "msg"; }, ms);
}

// =====================
// Estado lector/cámara
// =====================
let html5QrCode = null;
let isScanning = false;
let isTransition = false;      // evita “already under transition”
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

// =====================
// Helpers cámara
// =====================
async function getCameras() {
  try { return await Html5Qrcode.getCameras(); }
  catch { return []; }
}

async function ensurePermission() {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    s.getTracks().forEach(t => t.stop());
  } catch {
    throw new Error("Permiso de cámara denegado");
  }
}

async function stopReader() {
  if (!html5QrCode || !isScanning) { isScanning = false; return; }
  if (isTransition) return;
  isTransition = true;
  try { await html5QrCode.stop(); await html5QrCode.clear(); } catch {}
  isScanning = false;
  isTransition = false;
}

// =====================
// Lector QR (config robusta)
// =====================
async function startHtml5Qr(cameraIdOrConfig) {
  if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");

  await html5QrCode.start(
    cameraIdOrConfig,
    {
      fps: 12,
      qrbox: { width: 260, height: 260 },   // obliga a acercar (mejor lectura)
      aspectRatio: 1.7778,
      rememberLastUsedCamera: true,
      disableFlip: true,
      formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
      // minTimeBetweenScansMillis: 1500, // si tu build lo soporta
    },
    onScanSuccess,
    () => {}
  );

  // Fix móviles e intentar enfoque continuo / linterna
  const v = document.querySelector("#reader video");
  if (v) {
    v.setAttribute("playsinline",""); v.muted = true;
    try { await html5QrCode.applyVideoConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch {}
    // try { await html5QrCode.applyVideoConstraints({ advanced: [{ torch: true }] }); } catch {}
  }
}

// start con candado
async function startLocked(config) {
  if (isTransition || isScanning) return;
  isTransition = true;
  try {
    await startHtml5Qr(config);
    isScanning = true;
  } finally {
    isTransition = false;
  }
}

// =====================
// Escaneo estable
// =====================
let lastText = "", lastAt = 0;
let stable = { text: "", count: 0 };
let isPosting = false;

async function onScanSuccess(decodedText) {
  // Requiere 2 frames seguidos iguales
  if (decodedText !== stable.text) {
    stable = { text: decodedText, count: 1 };
    return;
  } else if (++stable.count < 2) {
    return;
  }
  stable = { text: "", count: 0 };

  const now = Date.now();
  if (decodedText === lastText && now - lastAt < 2000) return; // más “calmado”
  lastText = decodedText; lastAt = now;

  // Pausa mientras se POSTEA (evita doble envío)
  try { html5QrCode?.pause(true); } catch {}

  if (isPosting) return;
  isPosting = true;

  toast("Leyendo QR…");

  try {
    const r = await fetch(`${API}/asistencias/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_qr: decodedText })
    });

    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch { data = { detail: raw }; }
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);

    const who = data.alumno ?? data.nombre ?? ("ID " + (data.alumno_id ?? ""));
    const hh  = (data.hora || "").slice(11, 19);
    toast((data.status === "registrado" || data.ok)
      ? `✓ Registrado: ${who} · ${hh}`
      : `• Ya registrado hoy: ${who} · ${hh}`, "ok", 5000);
    if (navigator.vibrate) navigator.vibrate([100,30,100]);
  } catch (e) {
    console.error("Error de red/servidor:", e);
    toast((e?.name?`[${e.name}] `:"") + (e?.message || "Error de red / servidor"), "err", 6000);
  } finally {
    isPosting = false;
    setTimeout(() => { try { html5QrCode?.resume(); } catch {} }, 1200);
  }
}

// =====================
// UI
// =====================
$("btnScan")?.addEventListener("click", async () => {
  if (isScanning || isTransition) return;

  if (!(location.protocol === "https:" || ["localhost","127.0.0.1"].includes(location.hostname))) {
    toast("Usa HTTPS (ngrok) o localhost.", "err"); return;
  }

  $("reader").style.display = "block";
  $("btnScan").disabled = true;
  $("btnStop").style.display = "inline-block";

  try {
    await ensurePermission();

    // 1) detecta cámaras
    const cams = await getCameras();
    if (!cams.length) throw new Error("No se encontraron cámaras (permiso denegado o dispositivo ocupado)");

    // 2) elige trasera si existe
    const back = cams.find(c => /back|rear|environment|trasera/i.test(c.label));
    const first = cams[0];
    const last  = cams[cams.length - 1];

    // 3) Cascada anti pantalla-negra
    try {
      await startLocked({ deviceId: { exact: (back ?? first).id } });
      return;
    } catch { await stopReader(); await sleep(120); }

    try {
      await startLocked({ facingMode: { exact: "environment" } });
      return;
    } catch { await stopReader(); await sleep(120); }

    try {
      await startLocked({ facingMode: "environment" });
      return;
    } catch { await stopReader(); await sleep(120); }

    await startLocked({ deviceId: { exact: last.id } });

  } catch (err) {
    console.error("Fallo al iniciar cámara:", err);
    toast((err?.name?`[${err.name}] `:"") + (err?.message || "Error al iniciar"), "err", 6000);
    $("reader").style.display = "none";
    $("btnStop").style.display = "none";
    $("btnScan").disabled = false;
  }
});

$("btnStop")?.addEventListener("click", async () => {
  if (isTransition) return;
  await stopReader();
  $("reader").style.display = "none";
  $("btnScan").disabled = false;
  $("btnStop").style.display = "none";
  lastText = ""; lastAt = 0;
});

// Cambio manual desde el <select id="camSel"> (si lo tienes)
$("camSel")?.addEventListener("change", async (e) => {
  const id = e.target.value;
  if (!id || isTransition) return;
  try {
    await stopReader();
    await sleep(150);
    $("reader").style.display = "block";
    $("btnStop").style.display = "inline-block";
    $("btnScan").disabled = true;
    await startLocked({ deviceId: { exact: id } }); // sin width/height
  } catch (err) {
    console.error(err);
    toast("No se pudo cambiar de cámara", "err");
  }
});

// Pausar si la pestaña se oculta (evita quedarnos con negro)
document.addEventListener("visibilitychange", async () => {
  if (!html5QrCode) return;
  try {
    if (document.hidden && isScanning) html5QrCode.pause(true);
    else if (!document.hidden && isScanning) html5QrCode.resume();
  } catch {}
});

// =====================
// Arranque: llenar combo cámaras
// =====================
(async () => {
  try {
    await ensurePermission();
    const cams = await getCameras();
    const sel = $("camSel");
    if (sel) {
      sel.innerHTML = "";
      cams.forEach(c => {
        const o = document.createElement("option");
        o.value = c.id; o.textContent = c.label || c.id;
        sel.appendChild(o);
      });
      const back = cams.find(c => /back|rear|environment|trasera/i.test(c.label));
      if (back) sel.value = back.id;
    }
  } catch {
    // se pedirá al iniciar
  }
})();
