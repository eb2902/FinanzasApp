import { Request, Response } from 'express';
import authService from '../services/auth.service';
import logger from '../services/logger';

/**
 * Controlador de autenticación
 * Maneja las rutas de registro e inicio de sesión
 */
class AuthController {
  /**
   * Registra un nuevo usuario
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      // Obtener datos validados del middleware
      const { email, password } = req.body;

      // Registrar usuario
      const user = await authService.registerUser(email, password);

      // Responder con éxito
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: {
          user,
          token: null // No se devuelve token en el registro, debe hacer login
        }
      });
    } catch (error) {
      logger.error(error, 'Error en registro de usuario');

      // Manejo de errores específicos
      if (error instanceof Error) {
        if (error.message === 'El email ya está registrado') {
          res.status(409).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      // Error genérico
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Inicia sesión de usuario
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      // Obtener datos validados del middleware
      const { email, password } = req.body;

      // Iniciar sesión
      const { token, user } = await authService.loginUser(email, password);

      // Responder con éxito
      res.status(200).json({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: {
          user,
          token
        }
      });
    } catch (error) {
      logger.error(error, 'Error en inicio de sesión');

      // Manejo de errores específicos
      if (error instanceof Error) {
        if (error.message === 'Credenciales inválidas') {
          res.status(401).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      // Error genérico
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Endpoint de prueba para verificar que el controlador funciona
   */
  async health(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Auth controller is working',
      timestamp: new Date().toISOString()
    });
  }
}

// Crear y exportar instancia del controlador
const authController = new AuthController();

export default authController;