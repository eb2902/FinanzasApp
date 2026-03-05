// Archivo de configuración para Jest
// Este archivo se ejecuta antes de cada suite de pruebas

// Configuración global para las pruebas
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_testing';
process.env.JWT_EXPIRES_IN = '1h';

// Configuración de la base de datos para pruebas
process.env.DB_HOST = process.env.DB_HOST || 'db_test';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.DB_NAME || 'fintech_app_test';
process.env.DB_USER = process.env.DB_USER || 'admin';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'password123';

// Suprimir logs durante las pruebas (opcional)
process.env.LOG_LEVEL = 'error';

// Inicializar base de datos de pruebas
import testDatabaseService from '../src/services/test-database';

beforeAll(async () => {
  try {
    await testDatabaseService.initializeTestDatabase();
    console.log('✅ Base de datos de pruebas inicializada');
  } catch (error) {
    console.warn('⚠️  Error al inicializar base de datos de pruebas:', error);
  }
});

afterAll(async () => {
  try {
    await testDatabaseService.cleanupTestDatabase();
    console.log('✅ Base de datos de pruebas limpiada');
  } catch (error) {
    console.warn('⚠️  Error al limpiar base de datos de pruebas:', error);
  }
});
