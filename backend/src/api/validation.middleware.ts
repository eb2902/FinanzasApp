import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../services/logger';

/**
 * Middleware de validación genérico para Zod schemas
 * @param schema Esquema de Zod para validar el body de la solicitud
 */
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validar el body de la solicitud
      const validatedData = schema.parse(req.body);
      
      // Si la validación es exitosa, reemplazar el body con los datos validados
      req.body = validatedData;
      
      // Continuar con el siguiente middleware/controlador
      next();
    } catch (error) {
      logger.warn(error, 'Error de validación de Zod');
      
      // Si es un error de validación de Zod, retornar 400 con detalles
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code
          }))
        });
        return;
      }
      
      // Error genérico
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
}

/**
 * Middleware de validación para el registro de usuario
 */
export const validateRegister = validateBody(require('./auth.schema').registerSchema);

/**
 * Middleware de validación para el login de usuario
 */
export const validateLogin = validateBody(require('./auth.schema').loginSchema);