from fastapi import APIRouter, Depends
from pydantic import BaseModel
import re
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from sqlalchemy import func

from src.asistencias.db import get_db
from src.asistencias.models import Alumno, Asistencia

# Mantengo el prefix para no romper tu front: /asistencias/asistencias/scan
router = APIRouter(prefix="/asistencias")

class ScanIn(BaseModel):
    codigo_qr: str

def ahora_pe():
    return datetime.now(ZoneInfo("America/Lima"))

def limpiar_texto(raw: str) -> str:
    """
    Convierte a un nombre 'amigable': letras (incluye tildes/ñ), espacios y guiones.
    Colapsa espacios y recorta extremos.
    """
    txt = re.sub(r"[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s\-]", " ", raw or "")
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt

@router.post("/scan")
def registrar(scan: ScanIn, db: Session = Depends(get_db)):
    txt_raw = (scan.codigo_qr or "").strip()
    hora_pe = ahora_pe()

    # 1) ¿trae un número? => úsalo como ID preferente
    alumno = None
    m = re.search(r"\d+", txt_raw)
    if m:
        alumno_id = int(m.group())
        alumno = db.get(Alumno, alumno_id)
        if not alumno:
            # Intentamos sacar un nombre legible del QR
            nombre_limpio = limpiar_texto(txt_raw)
            if not nombre_limpio:
                nombre_limpio = f"Alumno {alumno_id}"
            # Crea alumno con ese ID
            alumno = Alumno(id=alumno_id, nombre=nombre_limpio, apellido=None)
            db.add(alumno)
            db.flush()  # asigna ID sin cerrar transacción

    # 2) Si no hay ID o no encontramos, usar el nombre del QR
    if not alumno:
        nombre_limpio = limpiar_texto(txt_raw)
        if nombre_limpio:
            # separar nombre/apellido (opcional)
            partes = nombre_limpio.split(" ")
            nombre = partes[0].capitalize()
            apellido = " ".join(p.capitalize() for p in partes[1:]) if len(partes) > 1 else None

            # buscar coincidencia exacta-insensible
            q = db.query(Alumno).filter(func.lower(Alumno.nombre) == func.lower(nombre))
            if apellido:
                q = q.filter(func.coalesce(func.lower(Alumno.apellido), "") == func.coalesce(func.lower(apellido), ""))
            alumno = q.first()

            if not alumno:
                alumno = Alumno(nombre=nombre, apellido=apellido)
                db.add(alumno)
                db.flush()
        else:
            # Si ni siquiera podemos formar un nombre, guardamos el QR como está,
            # pero igualmente lo registramos (sin alumno asociado)
            row = Asistencia(alumno_id=None, texto_qr=txt_raw, status="qr_sin_id", hora=hora_pe)
            db.add(row); db.commit(); db.refresh(row)
            return {"status": "qr_sin_id", "qr": txt_raw, "hora": row.hora.isoformat()}

    # 3) Registrar asistencia (siempre 'registrado' porque ya garantizamos alumno)
    row = Asistencia(alumno_id=alumno.id, texto_qr=txt_raw, status="registrado", hora=hora_pe)
    db.add(row); db.commit(); db.refresh(row)

    nombre_out = f"{alumno.nombre} {alumno.apellido or ''}".strip()
    return {
        "status": "registrado",
        "alumno_id": alumno.id,
        "alumno": nombre_out,
        "hora": row.hora.isoformat(),
    }

@router.get("")
def listar_ultimas(limit: int = 50, db: Session = Depends(get_db)):
    q = (db.query(Asistencia).order_by(Asistencia.hora.desc())
         .limit(max(1, min(limit, 200))).all())
    def row2dict(a: Asistencia):
        return {
            "id": a.id,
            "texto_qr": a.texto_qr,
            "status": a.status,
            "hora": a.hora.isoformat(),
            "alumno_id": a.alumno_id,
            "alumno": (f"{a.alumno.nombre} {a.alumno.apellido or ''}".strip()
                       if a.alumno else None),
        }
    return [row2dict(a) for a in q]
