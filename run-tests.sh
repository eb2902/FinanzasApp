#!/bin/bash

# Script para ejecutar pruebas con Docker

echo "🚀 Iniciando pruebas con Docker..."

# Construir las imágenes
echo "📦 Construyendo imágenes..."
docker-compose build backend_test

# Iniciar solo los servicios de pruebas
echo "🐳 Iniciando servicios de pruebas..."
docker-compose up -d db_test backend_test

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios estén listos..."
sleep 10

# Mostrar logs de las pruebas
echo "📋 Mostrando logs de pruebas..."
docker-compose logs -f backend_test

# Detener los servicios después de las pruebas
echo "🛑 Deteniendo servicios de pruebas..."
docker-compose down

echo "✅ Pruebas completadas!"