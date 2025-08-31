# src/asistencias/api/main.py
from pathlib import Path
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

# Routers
from src.asistencias.api import alumnos, asistencias

# DB (crear tablas en startup)
from src.asistencias.db import engine, Base      # <-- nuevo
from src.asistencias import models               # <-- asegura que registre modelos

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
    allow_origin_regex=r"https://.*\.ngrok-free\.app$",  # cualquier subdominio de ngrok
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Health ---
@app.get("/health")
def health_check():
    return {"ok": True}

# --- Routers ---
# Nota: hoy usas doble prefijo efectivo para 'asistencias':
# en main.py prefix="/asistencias" y en asistencias.py también.
# Si más adelante quieres que sea /asistencias/scan (sin duplicado),
# quita el prefix del router o el de aquí.
app.include_router(alumnos.router, prefix="/alumnos", tags=["Alumnos"])
app.include_router(asistencias.router, prefix="/asistencias", tags=["Asistencias"])

# --- Static (PWA) ---
# main.py está en src/asistencias/api/main.py → subimos 3 niveles a la raíz del repo
BASE_DIR = Path(__file__).resolve().parents[3]
STATIC_DIR = BASE_DIR / "web-pwa"
app.mount("/app", StaticFiles(directory=str(STATIC_DIR), html=True), name="app")

@app.get("/")
def root():
    return RedirectResponse(url="/app/")

# --- Startup: crear carpeta data/ y tablas SQLite ---
@app.on_event("startup")
def on_startup():
    os.makedirs("data", exist_ok=True)   # ./data/asistencias.db
    Base.metadata.create_all(bind=engine)
