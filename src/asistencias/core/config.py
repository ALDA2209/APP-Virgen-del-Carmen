from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseModel):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./asistencias.db")
    ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:5500").split(",")
    MAIL_BACKEND: str = os.getenv("MAIL_BACKEND", "gmail")
    MAIL_USER: str | None = os.getenv("MAIL_USER")
    MAIL_PASS: str | None = os.getenv("MAIL_PASS")
    MAIL_FROM: str = os.getenv("MAIL_FROM", "asistencias@colegio.local")
    QR_SECRET: str = os.getenv("QR_SECRET", "dev-secret")

settings = Settings()
