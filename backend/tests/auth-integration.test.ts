import request from 'supertest';
import app from '../src/index';
import dbService from '../src/services/db.service';
import authService from '../src/services/auth.service';

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

describe('Auth Integration Tests', () => {
  // Limpiar la tabla de usuarios antes de cada prueba
  beforeEach(async () => {
    try {
      await dbService.query('DELETE FROM users WHERE email LIKE $1', ['test_%']);
    } catch (error) {
      console.warn('Could not clean up test users:', error);
    }
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full registration and login flow', async () => {
      const userData = {
        email: 'integration_test@example.com',
        password: 'TestPassword123'
      };

      // 1. Registrar usuario
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body).toMatchObject({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: {
          user: {
            email: userData.email,
            kycStatus: 'PENDING'
          },
          token: null
        }
      });

      const userId = registerResponse.body.data.user.id;

      // 2. Verificar que el usuario fue creado en la base de datos
      const dbResult = await dbService.query(
        'SELECT id, email, kyc_status FROM users WHERE id = $1',
        [userId]
      );

      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0]).toMatchObject({
        id: userId,
        email: userData.email,
        kyc_status: 'PENDING'
      });

      // 3. Iniciar sesión
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(userData)
        .expect(200);

      expect(loginResponse.body).toMatchObject({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: {
          user: {
            email: userData.email,
            kycStatus: 'PENDING'
          }
        }
      });

      const token = loginResponse.body.data.token;
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // 4. Verificar token con el servicio directamente
      const tokenData = await authService.verifyToken(token);
      expect(tokenData).toMatchObject({
        userId,
        email: userData.email,
        kycStatus: 'PENDING'
      });

      // 5. Acceder a ruta protegida con el token
      const protectedResponse = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(protectedResponse.body).toMatchObject({
        success: true,
        message: 'Ruta protegida accedida exitosamente',
        user: {
          userId,
          email: userData.email,
          kycStatus: 'PENDING'
        }
      });
    });

    it('should handle KYC status changes through integration', async () => {
      const userData = {
        email: 'kyc_integration_test@example.com',
        password: 'TestPassword123'
      };

      // Registrar e iniciar sesión
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(userData)
        .expect(200);

      const token = loginResponse.body.data.token;

      // Intentar acceder a ruta que requiere KYC verificado (debería fallar)
      await request(app)
        .get('/api/v1/auth/kyc-required')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      // Actualizar KYC a VERIFIED directamente en la base de datos
      await dbService.query(
        'UPDATE users SET kyc_status = $1 WHERE email = $2',
        ['VERIFIED', userData.email]
      );

      // Ahora debería poder acceder
      const kycResponse = await request(app)
        .get('/api/v1/auth/kyc-required')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(kycResponse.body).toMatchObject({
        success: true,
        message: 'Ruta con KYC requerido accedida exitosamente',
        user: {
          email: userData.email,
          kycStatus: 'VERIFIED'
        }
      });
    });
  });

  describe('Cross-Service Integration', () => {
    it('should work correctly with direct service calls and API calls', async () => {
      const email = 'cross_service_test@example.com';
      const password = 'TestPassword123';

      // Registrar usando el servicio directamente
      const registeredUser = await authService.registerUser(email, password);

      // Verificar que el usuario existe en la base de datos
      const dbResult = await dbService.query(
        'SELECT id, email, kyc_status FROM users WHERE id = $1',
        [registeredUser.id]
      );

      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].email).toBe(email);

      // Iniciar sesión usando el servicio directamente
      const loginResult = await authService.loginUser(email, password);

      expect(loginResult).toHaveProperty('token');
      expect(loginResult).toHaveProperty('user');
      expect(loginResult.user.email).toBe(email);

      // Verificar token
      const tokenData = await authService.verifyToken(loginResult.token);
      expect(tokenData).toMatchObject({
        email: email,
        kycStatus: 'PENDING'
      });

      // Ahora intentar iniciar sesión a través de la API con el mismo usuario
      const apiLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);

      expect(apiLoginResponse.body.data.user.email).toBe(email);
      expect(apiLoginResponse.body.data.token).toBeDefined();

      // Los tokens deberían ser diferentes (generados en momentos diferentes)
      // pero ambos deberían ser válidos
      const apiTokenData = await authService.verifyToken(apiLoginResponse.body.data.token);
      expect(apiTokenData).toMatchObject({
        email: email,
        kycStatus: 'PENDING'
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database errors gracefully across all layers', async () => {
      const userData = {
        email: 'error_handling_test@example.com',
        password: 'TestPassword123'
      };

      // Registrar usuario exitosamente
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      // Intentar registrar el mismo usuario (debería fallar con 409)
      const duplicateResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(409);

      expect(duplicateResponse.body).toMatchObject({
        success: false,
        message: 'El email ya está registrado'
      });

      // Intentar iniciar sesión con credenciales incorrectas
      const wrongPasswordResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: userData.email,
          password: 'WrongPassword'
        })
        .expect(401);

      expect(wrongPasswordResponse.body).toMatchObject({
        success: false,
        message: 'Credenciales inválidas'
      });

      // Intentar iniciar sesión con email inexistente
      const nonExistentResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123'
        })
        .expect(401);

      expect(nonExistentResponse.body).toMatchObject({
        success: false,
        message: 'Credenciales inválidas'
      });
    });

    it('should handle middleware errors correctly', async () => {
      // Intentar acceder a ruta protegida sin token
      const noTokenResponse = await request(app)
        .get('/api/v1/auth/protected')
        .expect(401);

      expect(noTokenResponse.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. Token no proporcionado o formato inválido'
      });

      // Intentar acceder con token inválido
      const invalidTokenResponse = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(invalidTokenResponse.body).toMatchObject({
        success: false,
        message: 'Token inválido o expirado'
      });

      // Intentar acceder a ruta con KYC requerido sin KYC verificado
      const userData = {
        email: 'kyc_error_test@example.com',
        password: 'TestPassword123'
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(userData)
        .expect(200);

      const token = loginResponse.body.data.token;

      const kycRequiredResponse = await request(app)
        .get('/api/v1/auth/kyc-required')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(kycRequiredResponse.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. KYC no verificado. Por favor complete su verificación.'
      });
    });
  });

  describe('Data Consistency Integration', () => {
    it('should maintain data consistency across registration, login, and token verification', async () => {
      const userData = {
        email: 'consistency_test@example.com',
        password: 'TestPassword123'
      };

      // Registrar usuario
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      const registeredUser = registerResponse.body.data.user;

      // Verificar datos en base de datos
      const dbUser = await dbService.query(
        'SELECT id, email, kyc_status, created_at FROM users WHERE id = $1',
        [registeredUser.id]
      );

      expect(dbUser.rows[0]).toMatchObject({
        id: registeredUser.id,
        email: registeredUser.email,
        kyc_status: registeredUser.kycStatus,
        created_at: registeredUser.createdAt
      });

      // Iniciar sesión
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(userData)
        .expect(200);

      const loggedInUser = loginResponse.body.data.user;
      const token = loginResponse.body.data.token;

      // Verificar que los datos del usuario sean consistentes
      expect(loggedInUser.id).toBe(registeredUser.id);
      expect(loggedInUser.email).toBe(registeredUser.email);
      expect(loggedInUser.kycStatus).toBe(registeredUser.kycStatus);
      expect(loggedInUser.createdAt).toBe(registeredUser.createdAt);

      // Verificar token
      const tokenData = await authService.verifyToken(token);
      expect(tokenData).toMatchObject({
        userId: registeredUser.id,
        email: registeredUser.email,
        kycStatus: registeredUser.kycStatus
      });
    });

    it('should handle concurrent registration attempts correctly', async () => {
      const email = 'concurrent_test@example.com';
      const password = 'TestPassword123';

      // Intentar registrar el mismo usuario concurrentemente
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          request(app)
            .post('/api/v1/auth/register')
            .send({ email, password })
        );
      }

      const responses = await Promise.all(promises);

      // Una solicitud debería tener éxito (201)
      // Las demás deberían fallar (409)
      const successResponses = responses.filter(r => r.status === 201);
      const conflictResponses = responses.filter(r => r.status === 409);

      expect(successResponses).toHaveLength(1);
      expect(conflictResponses).toHaveLength(2);

      successResponses.forEach(response => {
        expect(response.body).toMatchObject({
          success: true,
          message: 'Usuario registrado exitosamente'
        });
      });

      conflictResponses.forEach(response => {
        expect(response.body).toMatchObject({
          success: false,
          message: 'El email ya está registrado'
        });
      });
    });
  });

  describe('API Contract Integration', () => {
    it('should maintain consistent API response format across all auth endpoints', async () => {
      const userData = {
        email: 'contract_test@example.com',
        password: 'TestPassword123'
      };

      // Test registration response format
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body).toHaveProperty('success', true);
      expect(registerResponse.body).toHaveProperty('message');
      expect(registerResponse.body).toHaveProperty('data');
      expect(registerResponse.body.data).toHaveProperty('user');
      expect(registerResponse.body.data).toHaveProperty('token', null);

      // Test login response format
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(userData)
        .expect(200);

      expect(loginResponse.body).toHaveProperty('success', true);
      expect(loginResponse.body).toHaveProperty('message');
      expect(loginResponse.body).toHaveProperty('data');
      expect(loginResponse.body.data).toHaveProperty('user');
      expect(loginResponse.body.data).toHaveProperty('token');

      // Test health endpoint response format
      const healthResponse = await request(app)
        .get('/api/v1/auth/health')
        .expect(200);

      expect(healthResponse.body).toHaveProperty('success', true);
      expect(healthResponse.body).toHaveProperty('message');
      expect(healthResponse.body).toHaveProperty('timestamp');

      // Test error response format
      const errorResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword'
        })
        .expect(401);

      expect(errorResponse.body).toHaveProperty('success', false);
      expect(errorResponse.body).toHaveProperty('message');
      expect(errorResponse.body).not.toHaveProperty('data');
    });
  });
});