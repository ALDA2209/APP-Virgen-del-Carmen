import sqlite3

conn = sqlite3.connect("data/asistencias.db")
cur = conn.cursor()

print("Columnas de la tabla asistencias:")
cur.execute("PRAGMA table_info(asistencias)")
for col in cur.fetchall():
    print(col)

conn.close()
