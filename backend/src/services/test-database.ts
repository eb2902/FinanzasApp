import dbService from './db.service';
import logger from './logger';

/**
 * Servicio para inicializar la base de datos de pruebas
 * Ejecuta las migraciones en la base de datos de pruebas
 */
class TestDatabaseService {
  /**
   * Inicializa la base de datos de pruebas
   */
  async initializeTestDatabase(): Promise<void> {
    try {
      // Conectar a la base de datos
      await dbService.connect();
      logger.info('Conexión a base de datos de pruebas exitosa');

      // Ejecutar las migraciones (el mismo script que se usa en producción)
      await this.runMigrations();
      
      logger.info('Base de datos de pruebas inicializada exitosamente');
    } catch (error) {
      logger.error(error, 'Error al inicializar base de datos de pruebas');
      throw error;
    }
  }

  /**
   * Ejecuta las migraciones de la base de datos
   */
  private async runMigrations(): Promise<void> {
    try {
      // Leer el archivo de migración
      const fs = require('fs');
      const path = require('path');
      
      // Ruta al archivo de migración
      const migrationFile = path.join(__dirname, '../models/init.sql');
      const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

      // Ejecutar las migraciones
      await dbService.query(migrationSQL);
      
      logger.info('Migraciones ejecutadas exitosamente');
    } catch (error) {
      logger.error(error, 'Error al ejecutar migraciones');
      throw error;
    }
  }

  /**
   * Limpia la base de datos de pruebas
   */
  async cleanupTestDatabase(): Promise<void> {
    try {
      // Limpiar tablas en orden para evitar problemas de foreign keys
      await dbService.query('DELETE FROM transactions');
      await dbService.query('DELETE FROM accounts');
      await dbService.query('DELETE FROM users');
      
      logger.info('Base de datos de pruebas limpiada exitosamente');
    } catch (error) {
      logger.error(error, 'Error al limpiar base de datos de pruebas');
      throw error;
    }
  }
}

// Crear y exportar instancia del servicio
const testDatabaseService = new TestDatabaseService();

export default testDatabaseService;