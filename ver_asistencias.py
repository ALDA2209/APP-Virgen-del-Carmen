import sqlite3

conn = sqlite3.connect("data/asistencias.db")
cur = conn.cursor()

print("Últimos registros:")
for row in cur.execute("""
  SELECT a.nombre, s.hora, s.texto_qr, s.status
  FROM asistencias s
  JOIN alumnos a ON a.id = s.alumno_id
  ORDER BY s.hora DESC
  LIMIT 10
"""):
    print(row)

conn.close()
