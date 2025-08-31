from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from src.asistencias.db import get_db
from src.asistencias.models import Alumno

router = APIRouter()

# ===== Schemas =====
class AlumnoIn(BaseModel):
    # si mandas id, lo usamos (útil para que tu QR "25" exista);
    # si no, se autoincrementa.
    id: int | None = Field(default=None, ge=1)
    nombre: str
    apellido: str | None = None
    grado: str | None = None
    seccion: str | None = None

class AlumnoOut(BaseModel):
    id: int
    nombre: str
    apellido: str | None
    grado: str | None
    seccion: str | None
    class Config:
        from_attributes = True

# ===== Endpoints =====
@router.get("/", response_model=list[AlumnoOut])
def listar_alumnos(db: Session = Depends(get_db)):
    return db.query(Alumno).order_by(Alumno.id.asc()).all()

@router.get("/{alumno_id}", response_model=AlumnoOut)
def obtener_alumno(alumno_id: int, db: Session = Depends(get_db)):
    a = db.get(Alumno, alumno_id)
    if not a:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    return a

@router.post("/", response_model=AlumnoOut)
def crear_alumno(data: AlumnoIn, db: Session = Depends(get_db)):
    if data.id is not None and db.get(Alumno, data.id):
        raise HTTPException(status_code=409, detail="Ya existe un alumno con ese ID")
    a = Alumno(
        id=data.id,
        nombre=data.nombre,
        apellido=data.apellido,
        grado=data.grado,
        seccion=data.seccion,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a
