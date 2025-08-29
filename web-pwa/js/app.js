// =====================
// Config (compatible)
// =====================
const DEFAULT_API = "http://127.0.0.1:8000"; // dev local
const API = localStorage.getItem("API_BASE") || DEFAULT_API;
// Para cambiarla desde la consola del navegador:
//   localStorage.setItem("API_BASE", "https://tu-api.com"); location.reload();

// Helpers
const $ = (id) => document.getElementById(id);

function mensaje(texto, esError = false) {
  const msg = $("msg");
  if (!msg) return;
  msg.textContent = texto || "";
  msg.className = esError ? "err" : "ok";
  if (texto) setTimeout(() => (msg.textContent = ""), 3000);
}

function renderLista(alumnos) {
  const lista = $("lista-alumnos");
  if (!lista) return;
  lista.innerHTML = "";

  if (!alumnos || !alumnos.length) {
    lista.innerHTML = `<li class="empty">(Sin alumnos aún)</li>`;
    return;
  }

  alumnos.forEach((a) => {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <span class="item-name">${a.nombre} ${a.apellido}</span>
      <span class="item-meta">${a.grado} ${a.seccion} · ID ${a.id}</span>
    `;
    lista.appendChild(li);
  });
}

// =====================
// Carga inicial
// =====================
async function cargarAlumnos() {
  try {
    const res = await fetch(`${API}/alumnos`); // evita doble slash final
    if (!res.ok) throw new Error("No se pudo cargar alumnos");
    const alumnos = await res.json();
    renderLista(alumnos);
  } catch (err) {
    console.error(err);
    mensaje(err.message || "Error al cargar", true);
  }
}

// =====================
// Registrar alumno
// =====================
async function registrarAlumno(e) {
  e.preventDefault();

  const nombre = $("nombre")?.value.trim();
  const apellido = $("apellido")?.value.trim();
  const grado = $("grado")?.value.trim();
  const seccion = $("seccion")?.value.trim();

  if (!nombre || !apellido || !grado || !seccion) {
    mensaje("Completa todos los campos.", true);
    return;
  }

  const btn = $("btn-enviar");
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${API}/alumnos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, apellido, grado, seccion }),
    });
    if (!res.ok) throw new Error("No se pudo registrar el alumno");
    const data = await res.json();

    $("form-alumno")?.reset();
    mensaje(`Alumno registrado: ${data.nombre} ${data.apellido}`);
    await cargarAlumnos();
  } catch (err) {
    console.error(err);
    mensaje(err.message || "Error al registrar", true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// =====================
// Eventos
// =====================
document.addEventListener("DOMContentLoaded", () => {
  $("form-alumno")?.addEventListener("submit", registrarAlumno);
  cargarAlumnos();
});
