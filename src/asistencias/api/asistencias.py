from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import date, datetime
import re

router = APIRouter()

# ===== Modelos =====
class Asistencia(BaseModel):
    alumno_id: int
    fecha: date
    presente: bool = True

class ScanPayload(BaseModel):
    codigo_qr: str

# ===== "BD" en memoria =====
asistencias_db: list[Asistencia] = []                # compatible con tu POST/GET actuales
_asistencias_idx: set[tuple[date, int]] = set()      # para evitar duplicados (fecha, alumno_id)

# Importa la "BD" de alumnos para validar
try:
    from src.asistencias.api.alumnos import _alumnos  # lista de AlumnoOut
except Exception:
    _alumnos = []

def _parse_id(desde_qr: str) -> int | None:
    """
    Acepta:
      - "123"
      - "ID:123", "ID-123", "ALUMNO=123", etc. (toma el último número)
    """
    t = (desde_qr or "").strip()
    m = re.search(r'(\d+)$', t)
    return int(m.group(1)) if m else None

def _existe_alumno(alumno_id: int) -> bool:
    return any(a.id == alumno_id for a in _alumnos)

# ===== Endpoints compatibles que ya tenías =====
@router.get("/", response_model=list[Asistencia])
def listar_asistencias():
    return asistencias_db

@router.post("/", response_model=Asistencia)
def registrar_asistencia(asistencia: Asistencia):
    # Evita duplicado por día si quieres también aquí:
    clave = (asistencia.fecha, asistencia.alumno_id)
    if clave in _asistencias_idx:
        # Ya existe para ese día; devolvemos la misma asistencia sin duplicarla
        return asistencia
    asistencias_db.append(asistencia)
    _asistencias_idx.add(clave)
    return asistencia

# ===== Endpoint para el escáner =====
@router.post("/scan")
def registrar_asistencia_por_qr(payload: ScanPayload):
    alumno_id = _parse_id(payload.codigo_qr)
    if alumno_id is None:
        raise HTTPException(status_code=400, detail="QR inválido: no encuentro ID numérico")

    if not _existe_alumno(alumno_id):
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    hoy = date.today()
    clave = (hoy, alumno_id)

    if clave in _asistencias_idx:
        return {"ok": True, "status": "duplicado", "alumno_id": alumno_id, "fecha": hoy.isoformat()}

    asistencias_db.append(Asistencia(alumno_id=alumno_id, fecha=hoy, presente=True))
    _asistencias_idx.add(clave)

    return {"ok": True, "status": "registrado", "alumno_id": alumno_id, "fecha": hoy.isoformat(), "hora": datetime.now().isoformat()}
