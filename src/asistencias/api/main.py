# src/asistencias/api/main.py
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.asistencias.api import alumnos, asistencias

app = FastAPI(title="Asistencias API")

# --- CORS ---
ALLOWED_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://localhost:5173",
    "http://localhost:8080",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.ngrok-free\.app$",  # acepta cualquier subdominio de ngrok
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Health ---
@app.get("/health")
def health_check():
    return {"ok": True}

# --- Routers ---
app.include_router(alumnos.router, prefix="/alumnos", tags=["Alumnos"])
app.include_router(asistencias.router, prefix="/asistencias", tags=["Asistencias"])

# --- Static (PWA) ---
# main.py está en src/asistencias/api/main.py → subimos 3 niveles hasta la raíz del repo
BASE_DIR = Path(__file__).resolve().parents[3]
STATIC_DIR = BASE_DIR / "web-pwa"
# print("STATIC_DIR =", STATIC_DIR)  # descomenta si quieres verificar en consola

app.mount("/app", StaticFiles(directory=str(STATIC_DIR), html=True), name="app")

from fastapi.responses import RedirectResponse

@app.get("/")
def root():
    return RedirectResponse(url="/app/")

