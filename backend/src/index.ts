import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { requestLogger } from './middleware/logging';
import { initializeDatabase, testConnection } from './services/database';
import logger from './services/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(requestLogger);
app.use(cors());
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      logger.warn(
        'Database connection failed. Server will start but database features may not work.'
      );
    } else {
      logger.info('Database connection successful');

      // Initialize database tables
      await initializeDatabase();
    }

    // Start server
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Server started');
      logger.info({ url: `http://localhost:${PORT}/health` }, 'Health check available');
      if (isConnected) {
        logger.info('Database initialized and ready');
      }
    });
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
