# Pruebas de Autenticación

Este documento explica cómo ejecutar las pruebas de autenticación con Docker.

## 🧪 Pruebas Disponibles

Las pruebas cubren los siguientes escenarios:

### Registro de Usuarios (`POST /api/v1/auth/register`)
- ✅ Registro exitoso de usuario
- ✅ Email duplicado (409 Conflict)
- ✅ Email inválido (400 Bad Request)
- ✅ Contraseña demasiado corta (400 Bad Request)
- ✅ Contraseña sin complejidad (400 Bad Request)
- ✅ Campos requeridos faltantes (400 Bad Request)

### Inicio de Sesión (`POST /api/v1/auth/login`)
- ✅ Login exitoso con credenciales correctas
- ✅ Contraseña incorrecta (401 Unauthorized)
- ✅ Email inexistente (401 Unauthorized)
- ✅ Campos requeridos faltantes (400 Bad Request)

### Health Check (`GET /api/v1/auth/health`)
- ✅ Endpoint de salud responde correctamente

## 🐳 Ejecución con Docker

### Opción 1: Script Automático (Recomendado)

```bash
# En Windows
./run-tests.bat

# En Linux/Mac
./run-tests.sh
```

### Opción 2: Comandos Manuales

```bash
# 1. Construir la imagen de pruebas
docker-compose build backend_test

# 2. Iniciar servicios de pruebas
docker-compose up -d db_test backend_test

# 3. Ver logs de pruebas
docker-compose logs -f backend_test

# 4. Detener servicios
docker-compose down
```

### Opción 3: Todo en Uno

```bash
# Iniciar todos los servicios (backend + tests)
docker-compose up --build
```

## 🔧 Configuración

### Variables de Entorno para Pruebas

Las pruebas utilizan una base de datos separada para no interferir con los datos de desarrollo:

- **DB_TEST_NAME**: `fintech_app_test` (por defecto)
- **JWT_SECRET**: `test_secret_key_for_testing`
- **JWT_EXPIRES_IN**: `1h`

### Archivos de Configuración

- `docker-compose.yml`: Configuración de servicios Docker
- `backend/jest.config.js`: Configuración de Jest
- `backend/tests/setup.ts`: Configuración de pruebas

## 📊 Resultados de Pruebas

Las pruebas están diseñadas para:

1. **Limpiar datos**: Eliminar usuarios de prueba antes de cada test
2. **Validar respuestas**: Verificar códigos de estado y formatos JSON
3. **Probar errores**: Validar manejo de errores y validaciones
4. **Verificar seguridad**: Asegurar que las contraseñas estén hasheadas

## 🚨 Solución de Problemas

### Problemas Comunes

1. **Puerto 5432 ocupado**: Cambia el puerto de `db_test` en `docker-compose.yml`
2. **Dependencias faltantes**: Asegúrate de que `devDependencies` estén instaladas
3. **Conexión a DB fallida**: Verifica que el healthcheck de PostgreSQL sea exitoso

### Comandos de Depuración

```bash
# Ver logs de la base de datos de pruebas
docker-compose logs db_test

# Ver logs del backend de pruebas
docker-compose logs backend_test

# Ejecutar shell en el contenedor de pruebas
docker-compose exec backend_test sh

# Ver estado de los servicios
docker-compose ps
```

## 🔄 Integración con CI/CD

Para integrar con GitHub Actions o Jenkins:

```yaml
# Ejemplo para GitHub Actions
- name: Run tests with Docker
  run: |
    docker-compose build backend_test
    docker-compose up -d db_test backend_test
    docker-compose logs backend_test
    docker-compose down
```

## 📈 Cobertura de Código

Para generar reporte de cobertura:

```bash
# Dentro del contenedor de pruebas
npm run test:coverage
```

## 🎯 Próximos Pasos

1. **Añadir más pruebas**: Pruebas de middleware, validaciones adicionales
2. **Pruebas de integración**: Pruebas con endpoints reales
3. **Pruebas de carga**: Simular múltiples usuarios concurrentes
4. **Mocking**: Mockear servicios externos para pruebas más rápidas