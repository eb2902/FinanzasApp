@echo off
REM Script para ejecutar pruebas con Docker en Windows

echo 🚀 Iniciando pruebas con Docker...

REM Construir las imágenes
echo 📦 Construyendo imágenes...
docker-compose build backend_test

REM Iniciar solo los servicios de pruebas
echo 🐳 Iniciando servicios de pruebas...
docker-compose up -d db_test backend_test

REM Esperar a que los servicios estén listos
echo ⏳ Esperando a que los servicios estén listos...
timeout /t 10 /nobreak

REM Mostrar logs de las pruebas
echo 📋 Mostrando logs de pruebas...
docker-compose logs -f backend_test

REM Detener los servicios después de las pruebas
echo 🛑 Deteniendo servicios de pruebas...
docker-compose down

echo ✅ Pruebas completadas!