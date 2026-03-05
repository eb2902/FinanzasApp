import { Request, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import logger from '../services/logger';

/**
 * Interfaz extendida para el Request con datos del usuario autenticado
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        kycStatus: string;
      };
    }
  }
}

/**
 * Middleware de autenticación
 * Verifica que el token JWT sea válido y adjunta los datos del usuario al request
 */
class AuthMiddleware {
  /**
   * Middleware para rutas protegidas
   * Verifica la presencia y validez del token JWT
   */
  async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Obtener token del header Authorization
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'Acceso denegado. Token no proporcionado o formato inválido'
        });
        return;
      }

      // Extraer token (eliminar el prefijo "Bearer ")
      const token = authHeader.substring(7);

      if (!token) {
        res.status(401).json({
          success: false,
          message: 'Acceso denegado. Token no proporcionado'
        });
        return;
      }

      // Verificar token
      const userData = await authService.verifyToken(token);

      if (!userData) {
        res.status(401).json({
          success: false,
          message: 'Token inválido o expirado'
        });
        return;
      }

      // Adjuntar datos del usuario al request
      req.user = userData;

      // Continuar con el siguiente middleware/controlador
      next();
    } catch (error) {
      logger.error(error, 'Error en middleware de autenticación');
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Middleware para verificar KYC verificado
   * Solo permite el acceso si el usuario tiene KYC verificado
   */
  requireKYCVerified(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Acceso denegado. Usuario no autenticado'
        });
        return;
      }

      if (req.user.kycStatus !== 'VERIFIED') {
        res.status(403).json({
          success: false,
          message: 'Acceso denegado. KYC no verificado. Por favor complete su verificación.'
        });
        return;
      }

      next();
    } catch (error) {
      logger.error(error, 'Error en middleware de KYC');
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Middleware para verificar que el usuario tenga al menos KYC pendiente
   * Útil para operaciones básicas que no requieren KYC completo
   */
  requireKYCStatus(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Acceso denegado. Usuario no autenticado'
        });
        return;
      }

      if (req.user.kycStatus === 'REJECTED') {
        res.status(403).json({
          success: false,
          message: 'Acceso denegado. Su cuenta ha sido rechazada'
        });
        return;
      }

      next();
    } catch (error) {
      logger.error(error, 'Error en middleware de estado KYC');
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

// Crear y exportar instancia del middleware
const authMiddleware = new AuthMiddleware();

export default authMiddleware;