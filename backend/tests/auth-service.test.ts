import authService from '../src/services/auth.service';
import dbService from '../src/services/db.service';
import bcrypt from 'bcrypt';

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

describe('AuthService', () => {
  // Limpiar la tabla de usuarios antes de cada prueba
  beforeEach(async () => {
    try {
      await dbService.query('DELETE FROM users WHERE email LIKE $1', ['test_%']);
    } catch (error) {
      console.warn('Could not clean up test users:', error);
    }
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const email = 'service_test@example.com';
      const password = 'TestPassword123';

      const user = await authService.registerUser(email, password);

      expect(user).toMatchObject({
        email: email.toLowerCase(),
        kycStatus: 'PENDING'
      });
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('createdAt');
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('should throw error if email already exists', async () => {
      const email = 'duplicate_service@example.com';
      const password = 'TestPassword123';

      // Registrar el primer usuario
      await authService.registerUser(email, password);

      // Intentar registrar el mismo email de nuevo
      await expect(authService.registerUser(email, password))
        .rejects
        .toThrow('El email ya está registrado');
    });

    it('should hash password before storing', async () => {
      const email = 'hash_test@example.com';
      const password = 'TestPassword123';

      const user = await authService.registerUser(email, password);

      // Verificar que la contraseña esté hasheada en la base de datos
      const result = await dbService.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [user.id]
      );

      const hashedPassword = result.rows[0].password_hash;
      
      // Verificar que la contraseña hasheada sea diferente de la original
      expect(hashedPassword).not.toBe(password);
      
      // Verificar que el hash sea válido usando bcrypt
      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should store email in lowercase', async () => {
      const email = 'UPPERCASE_TEST@EXAMPLE.COM';
      const password = 'TestPassword123';

      const user = await authService.registerUser(email, password);

      expect(user.email).toBe(email.toLowerCase());
    });
  });

  describe('loginUser', () => {
    const testEmail = 'login_service_test@example.com';
    const testPassword = 'TestPassword123';

    beforeEach(async () => {
      // Registrar un usuario para las pruebas de login
      await authService.registerUser(testEmail, testPassword);
    });

    it('should login successfully with correct credentials', async () => {
      const result = await authService.loginUser(testEmail, testPassword);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).toMatchObject({
        email: testEmail.toLowerCase(),
        kycStatus: 'PENDING'
      });
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('createdAt');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
    });

    it('should throw error with incorrect password', async () => {
      await expect(authService.loginUser(testEmail, 'WrongPassword'))
        .rejects
        .toThrow('Credenciales inválidas');
    });

    it('should throw error with non-existent email', async () => {
      await expect(authService.loginUser('nonexistent@example.com', testPassword))
        .rejects
        .toThrow('Credenciales inválidas');
    });

    it('should throw error with case-insensitive email', async () => {
      // Probar con email en mayúsculas
      const result = await authService.loginUser(testEmail.toUpperCase(), testPassword);

      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(testEmail.toLowerCase());
    });

    it('should include correct JWT payload', async () => {
      const result = await authService.loginUser(testEmail, testPassword);
      const jwt = require('jsonwebtoken');
      
      const decoded = jwt.verify(result.token, process.env.JWT_SECRET || 'test_secret');
      
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('kycStatus');
      expect(decoded.email).toBe(testEmail.toLowerCase());
      expect(decoded.kycStatus).toBe('PENDING');
    });
  });

  describe('verifyToken', () => {
    let validToken: string;
    const testEmail = 'verify_token_test@example.com';
    const testPassword = 'TestPassword123';

    beforeEach(async () => {
      // Registrar e iniciar sesión para obtener un token válido
      await authService.registerUser(testEmail, testPassword);
      const loginResult = await authService.loginUser(testEmail, testPassword);
      validToken = loginResult.token;
    });

    it('should return user data for valid token', async () => {
      const userData = await authService.verifyToken(validToken);

      expect(userData).toMatchObject({
        email: testEmail.toLowerCase(),
        kycStatus: 'PENDING'
      });
      expect(userData).toHaveProperty('userId');
    });

    it('should return null for invalid token', async () => {
      const userData = await authService.verifyToken('invalid_token');

      expect(userData).toBeNull();
    });

    it('should return null for expired token', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 'test', email: 'test@example.com', kycStatus: 'PENDING' },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '-1h' }
      );

      const userData = await authService.verifyToken(expiredToken);

      expect(userData).toBeNull();
    });

    it('should return null for token with invalid signature', async () => {
      const jwt = require('jsonwebtoken');
      const invalidSignatureToken = jwt.sign(
        { userId: 'test', email: 'test@example.com', kycStatus: 'PENDING' },
        'wrong_secret',
        { expiresIn: '1h' }
      );

      const userData = await authService.verifyToken(invalidSignatureToken);

      expect(userData).toBeNull();
    });

    it('should return null for token of deleted user', async () => {
      // Eliminar el usuario de la base de datos
      await dbService.query('DELETE FROM users WHERE email = $1', [testEmail]);

      const userData = await authService.verifyToken(validToken);

      expect(userData).toBeNull();
    });

    it('should return null for malformed token', async () => {
      const userData = await authService.verifyToken('not.a.jwt.token');

      expect(userData).toBeNull();
    });
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123';
      const hashedPassword = await authService.hashPassword(password);

      expect(hashedPassword).not.toBe(password);
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword.length).toBeGreaterThan(0);

      // Verificar que el hash sea válido
      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);

      expect(hash1).not.toBe(hash2);

      // Pero ambos deberían validar contra la misma contraseña
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'TestPassword123';
      const hashedPassword = await authService.hashPassword(password);

      const isValid = await authService.verifyPassword(password, hashedPassword);

      expect(isValid).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'TestPassword123';
      const wrongPassword = 'WrongPassword';
      const hashedPassword = await authService.hashPassword(password);

      const isValid = await authService.verifyPassword(wrongPassword, hashedPassword);

      expect(isValid).toBe(false);
    });

    it('should return false for empty password', async () => {
      const password = 'TestPassword123';
      const hashedPassword = await authService.hashPassword(password);

      const isValid = await authService.verifyPassword('', hashedPassword);

      expect(isValid).toBe(false);
    });
  });
});