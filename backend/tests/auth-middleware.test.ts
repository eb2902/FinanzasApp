import request from 'supertest';
import app from '../src/index';
import dbService from '../src/services/db.service';

// Configuración de Jest
beforeAll(async () => {
  try {
    await dbService.connect();
  } catch (error) {
    console.warn('Database connection failed, tests may not work properly:', error);
  }
});

afterAll(async () => {
  try {
    await dbService.disconnect();
  } catch (error) {
    console.warn('Error disconnecting from database:', error);
  }
});

describe('Auth Middleware', () => {
  // Limpiar la tabla de usuarios antes de cada prueba
  beforeEach(async () => {
    try {
      await dbService.query('DELETE FROM users WHERE email LIKE $1', ['test_%']);
    } catch (error) {
      console.warn('Could not clean up test users:', error);
    }
  });

  describe('authenticate middleware', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/auth/protected')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. Token no proporcionado o formato inválido'
      });
    });

    it('should reject requests with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. Token no proporcionado o formato inválido'
      });
    });

    it('should reject requests with Bearer prefix but no token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', 'Bearer ')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. Token no proporcionado o formato inválido'
      });
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', 'Bearer invalid_token_here')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Token inválido o expirado'
      });
    });

    it('should reject requests with expired token', async () => {
      // Crear un token expirado manualmente para esta prueba
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 'test', email: 'test@example.com' },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '-1h' } // Token expirado
      );

      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Token inválido o expirado'
      });
    });

    it('should attach user data to request with valid token', async () => {
      // Primero registrar e iniciar sesión para obtener un token válido
      const userData = {
        email: 'middleware_test@example.com',
        password: 'TestPassword123'
      };

      // Registrar usuario
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData);

      // Iniciar sesión para obtener token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(userData)
        .expect(200);

      const token = loginResponse.body.data.token;

      // Probar ruta protegida con token válido
      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Ruta protegida accedida exitosamente'
      });
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
    });
  });

  describe('requireKYCVerified middleware', () => {
    let validToken: string;

    beforeEach(async () => {
      // Registrar e iniciar sesión para obtener un token válido
      const userData = {
        email: 'kyc_test@example.com',
        password: 'TestPassword123'
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(userData)
        .expect(200);

      validToken = loginResponse.body.data.token;
    });

    it('should reject requests from unauthenticated users', async () => {
      const response = await request(app)
        .get('/api/v1/auth/kyc-required')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. Usuario no autenticado'
      });
    });

    it('should reject requests from users with PENDING KYC status', async () => {
      const response = await request(app)
        .get('/api/v1/auth/kyc-required')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. KYC no verificado. Por favor complete su verificación.'
      });
    });

    it('should reject requests from users with REJECTED KYC status', async () => {
      // Actualizar el estado KYC a REJECTED
      await dbService.query(
        'UPDATE users SET kyc_status = $1 WHERE email = $2',
        ['REJECTED', 'kyc_test@example.com']
      );

      const response = await request(app)
        .get('/api/v1/auth/kyc-required')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. KYC no verificado. Por favor complete su verificación.'
      });
    });

    it('should allow access for users with VERIFIED KYC status', async () => {
      // Actualizar el estado KYC a VERIFIED
      await dbService.query(
        'UPDATE users SET kyc_status = $1 WHERE email = $2',
        ['VERIFIED', 'kyc_test@example.com']
      );

      const response = await request(app)
        .get('/api/v1/auth/kyc-required')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Ruta con KYC requerido accedida exitosamente'
      });
      expect(response.body.user).toBeDefined();
      expect(response.body.user.kycStatus).toBe('VERIFIED');
    });
  });

  describe('requireKYCStatus middleware', () => {
    let validToken: string;

    beforeEach(async () => {
      const userData = {
        email: 'kyc_status_test@example.com',
        password: 'TestPassword123'
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(userData)
        .expect(200);

      validToken = loginResponse.body.data.token;
    });

    it('should reject requests from unauthenticated users', async () => {
      const response = await request(app)
        .get('/api/v1/auth/protected') // Usamos una ruta que solo necesita authenticate
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. Token no proporcionado o formato inválido'
      });
    });

    it('should allow access for users with PENDING KYC status', async () => {
      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Ruta protegida accedida exitosamente'
      });
    });

    it('should allow access for users with VERIFIED KYC status', async () => {
      await dbService.query(
        'UPDATE users SET kyc_status = $1 WHERE email = $2',
        ['VERIFIED', 'kyc_status_test@example.com']
      );

      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Ruta protegida accedida exitosamente'
      });
    });

    it('should reject requests from users with REJECTED KYC status', async () => {
      await dbService.query(
        'UPDATE users SET kyc_status = $1 WHERE email = $2',
        ['REJECTED', 'kyc_status_test@example.com']
      );

      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. Su cuenta ha sido rechazada'
      });
    });
  });
});