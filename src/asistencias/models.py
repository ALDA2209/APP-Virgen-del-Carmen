from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from zoneinfo import ZoneInfo
from .db import Base

def now_pe():
    return datetime.now(ZoneInfo("America/Lima"))

class Alumno(Base):
    __tablename__ = "alumnos"
    id       = Column(Integer, primary_key=True, index=True)
    nombre   = Column(String, nullable=False)
    apellido = Column(String, nullable=True)
    grado    = Column(String, nullable=True)
    seccion  = Column(String, nullable=True)

class Asistencia(Base):
    __tablename__ = "asistencias"
    id        = Column(Integer, primary_key=True, index=True)
    alumno_id = Column(Integer, ForeignKey("alumnos.id"), nullable=True)
    texto_qr  = Column(Text, nullable=False)
    status    = Column(String, nullable=False)  # registrado | qr_sin_id | alumno_no_encontrado
    hora      = Column(DateTime, nullable=False, default=now_pe)

    alumno = relationship("Alumno", lazy="joined")
