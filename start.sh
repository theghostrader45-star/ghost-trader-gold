#!/bin/bash
# Script de inicio permanente en el puerto 8081 para XAU/USD Dashboard
cd "$(dirname "$0")"

PORT=8081

# Si el puerto 8081 quedó ocupado por una sesión previa colgada, lo libera
PID=$(lsof -ti :$PORT)
if [ ! -z "$PID" ]; then
  echo "Liberando proceso previo (PID: $PID) en el puerto $PORT..."
  kill -9 $PID 2>/dev/null
  sleep 0.5
fi

echo "Iniciando Dashboard en puerto fijo $PORT..."
python3 server.py $PORT
