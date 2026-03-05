import { Router } from 'express';
import authController from './auth.controller';
import authMiddleware from './auth.middleware';
import { validateRegister, validateLogin } from './validation.middleware';

/**
 * Rutas de autenticación
 * Agrupa todas las rutas relacionadas con autenticación
 */
const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.get('/health', authController.health);

// Rutas de ejemplo para probar el middleware (pueden ser eliminadas después)
router.get('/protected', authMiddleware.authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Ruta protegida accedida exitosamente',
    user: req.user
  });
});

router.get('/kyc-required', 
  authMiddleware.authenticate, 
  authMiddleware.requireKYCVerified, 
  (req, res) => {
    res.json({
      success: true,
      message: 'Ruta con KYC requerido accedida exitosamente',
      user: req.user
    });
  }
);

router.get('/protected', 
  authMiddleware.authenticate, 
  authMiddleware.requireKYCStatus, 
  (req, res) => {
    res.json({
      success: true,
      message: 'Ruta protegida accedida exitosamente',
      user: req.user
    });
  }
);

export default router;