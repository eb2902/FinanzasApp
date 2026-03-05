import request from 'supertest';
import app from '../src/index';
import dbService from '../src/services/db.service';

// Configuración de Jest
beforeAll(async () => {
  // Asegurarse de que la base de datos esté conectada para las pruebas
  try {
    await dbService.connect();
  } catch (error) {
    console.warn('Database connection failed, tests may not work properly:', error);
  }
});

afterAll(async () => {
  // Limpiar después de las pruebas
  try {
    await dbService.disconnect();
  } catch (error) {
    console.warn('Error disconnecting from database:', error);
  }
});

describe('Auth API', () => {
  // Limpiar la tabla de usuarios antes de cada prueba
  beforeEach(async () => {
    try {
      await dbService.query('DELETE FROM users WHERE email LIKE $1', ['test_%']);
    } catch (error) {
      console.warn('Could not clean up test users:', error);
    }
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test_user@example.com',
        password: 'TestPassword123'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
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

      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user).toHaveProperty('createdAt');
    });

    it('should return 409 if email already exists', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'TestPassword123'
      };

      // Registrar el primer usuario
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      // Intentar registrar el mismo email de nuevo
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        message: 'El email ya está registrado'
      });
    });

    it('should return 400 if email is invalid', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 if password is too short', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123' // Contraseña demasiado corta
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 if password does not meet complexity requirements', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password' // No tiene mayúscula ni número
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const testUser = {
      email: 'login_test@example.com',
      password: 'TestPassword123'
    };

    beforeEach(async () => {
      // Registrar un usuario para las pruebas de login
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(testUser)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: {
          user: {
            email: testUser.email,
            kycStatus: 'PENDING'
          }
        }
      });

      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.token).toBeDefined();
      expect(typeof response.body.data.token).toBe('string');
      expect(response.body.data.token.length).toBeGreaterThan(0);
    });

    it('should return 401 with incorrect password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Credenciales inválidas'
      });
    });

    it('should return 401 with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Credenciales inválidas'
      });
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Datos de entrada inválidos'
      });
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/v1/auth/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Auth controller is working'
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});