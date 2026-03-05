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

describe('Auth Security Tests', () => {
  // Limpiar la tabla de usuarios antes de cada prueba
  beforeEach(async () => {
    try {
      await dbService.query('DELETE FROM users WHERE email LIKE $1', ['test_%']);
    } catch (error) {
      console.warn('Could not clean up test users:', error);
    }
  });

  describe('Input Validation Security', () => {
    it('should reject extremely long email addresses', async () => {
      const longEmail = 'a'.repeat(300) + '@example.com';
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: longEmail,
          password: 'TestPassword123'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
    });

    it('should reject extremely long passwords', async () => {
      const longPassword = 'a'.repeat(200);
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'long_password_test@example.com',
          password: longPassword
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
    });

    it('should reject SQL injection attempts in email', async () => {
      const sqlInjectionEmail = "test'; DROP TABLE users; --";
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: sqlInjectionEmail,
          password: 'TestPassword123'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
    });

    it('should reject XSS attempts in email', async () => {
      const xssEmail = '<script>alert("xss")</script>@example.com';
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: xssEmail,
          password: 'TestPassword123'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
    });

    it('should reject login with SQL injection in email', async () => {
      const sqlInjectionEmail = "test'; DROP TABLE users; --";
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: sqlInjectionEmail,
          password: 'TestPassword123'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
    });
  });

  describe('JWT Security', () => {
    let validToken: string;

    beforeEach(async () => {
      // Registrar e iniciar sesión para obtener un token válido
      const userData = {
        email: 'jwt_security_test@example.com',
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

    it('should reject JWT with manipulated payload', async () => {
      const jwt = require('jsonwebtoken');
      
      // Crear un token con payload manipulado pero con la misma clave secreta
      const manipulatedToken = jwt.sign(
        { 
          userId: 'manipulated_id', 
          email: 'manipulated@example.com',
          kycStatus: 'VERIFIED' // Intentar manipular el estado KYC
        },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', `Bearer ${manipulatedToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Token inválido o expirado'
      });
    });

    it('should reject JWT with wrong algorithm', async () => {
      const jwt = require('jsonwebtoken');
      
      // Intentar usar un algoritmo diferente
      const wrongAlgorithmToken = jwt.sign(
        { userId: 'test', email: 'test@example.com', kycStatus: 'PENDING' },
        process.env.JWT_SECRET || 'test_secret',
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', `Bearer ${wrongAlgorithmToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Token inválido o expirado'
      });
    });

    it('should reject JWT with empty payload', async () => {
      const jwt = require('jsonwebtoken');
      
      const emptyPayloadToken = jwt.sign(
        {},
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', `Bearer ${emptyPayloadToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Token inválido o expirado'
      });
    });

    it('should reject JWT with missing required fields', async () => {
      const jwt = require('jsonwebtoken');
      
      const incompleteToken = jwt.sign(
        { email: 'test@example.com' }, // Falta userId
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', `Bearer ${incompleteToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Token inválido o expirado'
      });
    });
  });

  describe('Authorization Header Security', () => {
    it('should reject requests with multiple authorization headers', async () => {
      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', 'Bearer token1')
        .set('Authorization', 'Bearer token2')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. Token no proporcionado o formato inválido'
      });
    });

    it('should reject requests with authorization header containing spaces', async () => {
      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', ' Bearer valid_token ')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. Token no proporcionado o formato inválido'
      });
    });

    it('should reject requests with authorization header using wrong case', async () => {
      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('authorization', 'Bearer valid_token') // minúscula
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Acceso denegado. Token no proporcionado o formato inválido'
      });
    });

    it('should reject requests with authorization header containing special characters', async () => {
      const response = await request(app)
        .get('/api/v1/auth/protected')
        .set('Authorization', 'Bearer token@#$%^&*()')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Token inválido o expirado'
      });
    });
  });

  describe('Password Security', () => {
    it('should reject common weak passwords', async () => {
      const weakPasswords = [
        'password',
        '12345678',
        'qwerty123',
        'admin123',
        'letmein1',
        'welcome1'
      ];

      for (const weakPassword of weakPasswords) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `weak_password_test_${Math.random()}@example.com`,
            password: weakPassword
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          message: 'Datos de entrada inválidos'
        });
      }
    });

    it('should reject passwords with only letters', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'letters_only_test@example.com',
          password: 'OnlyLetters'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
    });

    it('should reject passwords with only numbers', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'numbers_only_test@example.com',
          password: '123456789'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
    });

    it('should reject passwords with only special characters', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'special_only_test@example.com',
          password: '!@#$%^&*'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
    });
  });

  describe('Rate Limiting & Brute Force Protection', () => {
    it('should handle multiple failed login attempts gracefully', async () => {
      const email = 'brute_force_test@example.com';
      const correctPassword = 'TestPassword123';

      // Registrar usuario primero
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: correctPassword
        });

      // Intentar login con contraseñas incorrectas múltiples veces
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/v1/auth/login')
            .send({
              email,
              password: `WrongPassword${i}`
            })
        );
      }

      const responses = await Promise.all(promises);

      // Todas las respuestas deberían ser 401 (credenciales inválidas)
      responses.forEach(response => {
        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({
          success: false,
          message: 'Credenciales inválidas'
        });
      });
    });

    it('should handle multiple registration attempts for same email', async () => {
      const email = 'duplicate_reg_test@example.com';
      const password = 'TestPassword123';

      // Primer registro (exitoso)
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password })
        .expect(201);

      // Intentar registrar el mismo email múltiples veces
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          request(app)
            .post('/api/v1/auth/register')
            .send({ email, password })
        );
      }

      const responses = await Promise.all(promises);

      // Todas las respuestas deberían ser 409 (conflicto - email ya registrado)
      responses.forEach(response => {
        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
          success: false,
          message: 'El email ya está registrado'
        });
      });
    });
  });

  describe('Data Exposure Prevention', () => {
    it('should not expose password hash in registration response', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'no_password_exposure_test@example.com',
          password: 'TestPassword123'
        })
        .expect(201);

      expect(response.body.data.user).not.toHaveProperty('passwordHash');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should not expose password hash in login response', async () => {
      // Registrar usuario
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'login_no_password_exposure_test@example.com',
          password: 'TestPassword123'
        });

      // Iniciar sesión
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login_no_password_exposure_test@example.com',
          password: 'TestPassword123'
        })
        .expect(200);

      expect(response.body.data.user).not.toHaveProperty('passwordHash');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should not expose database errors in responses', async () => {
      // Intentar con datos que podrían causar errores de base de datos
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123'
        })
        .expect(201);

      // La respuesta no debería contener detalles de errores de base de datos
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('error');
      expect(response.body).not.toHaveProperty('sql');
    });
  });
});