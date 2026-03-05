import { Request, Response, NextFunction } from 'express';

import logger from '../services/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    };

    if (res.statusCode >= 400) {
      logger.warn(logData, 'HTTP request completed with error');
    } else {
      logger.info(logData, 'HTTP request completed');
    }
  });

  next();
}
