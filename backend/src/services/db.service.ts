import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

/**
 * Database service for managing PostgreSQL connections
 * Uses pg library with connection pooling and Docker support
 */
class DatabaseService {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    // Database connection configuration
    const config = {
      host: process.env.DB_HOST || 'db', // Default to 'db' for Docker Compose
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASSWORD || 'cambiame_por_favor',
      database: process.env.DB_NAME || 'fintech_app',
      ssl: false, // Disable SSL for Docker Compose development environment
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    };

    this.pool = new Pool(config);
  }

  /**
   * Establish connection to the database
   */
  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time');
      client.release();

      this.isConnected = true;
      logger.info({
        message: 'Database connection established successfully',
        host: process.env.DB_HOST || 'db',
        database: process.env.DB_NAME || 'fintech_app',
        timestamp: result.rows[0].current_time
      });
    } catch (error) {
      logger.error(error, 'Failed to connect to database');
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Close all connections in the pool
   */
  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connections closed successfully');
    } catch (error) {
      logger.error(error, 'Error closing database connections');
      throw error;
    }
  }

  /**
   * Execute a query using the connection pool
   * @param text - SQL query string
   * @param params - Query parameters
   * @returns Query result
   */
  async query(text: string, params?: any[]): Promise<any> {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      logger.error(error, `Query failed: ${text}`);
      throw error;
    }
  }

  /**
   * Get a single client from the pool for transactions
   * @returns Database client
   */
  async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      return client;
    } catch (error) {
      logger.error(error, 'Failed to get client from pool');
      throw error;
    }
  }

  /**
   * Test database connection
   * @returns Promise<boolean> - true if connection is successful
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      logger.error(error, 'Database connection test failed');
      return false;
    }
  }

  /**
   * Check if the service is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// Create and export singleton instance
const dbService = new DatabaseService();

export default dbService;