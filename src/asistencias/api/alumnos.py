from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class AlumnoIn(BaseModel):
    nombre: str
    apellido: str
    grado: str
    seccion: str

class AlumnoOut(AlumnoIn):
    id: int

# “BD” en memoria solo para pruebas (luego usaremos SQLite)
_alumnos: list[AlumnoOut] = []
_next_id = 1

@router.get("/", response_model=list[AlumnoOut])
def listar_alumnos():
    return _alumnos

@router.post("/", response_model=AlumnoOut)
def crear_alumno(data: AlumnoIn):
    global _next_id
    alumno = AlumnoOut(id=_next_id, **data.dict())
    _alumnos.append(alumno)
    _next_id += 1
    return alumno
