import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PoolClient } from 'pg';
import dbService from './db.service';
import logger from './logger';
import { User } from '../models';
import { RegisterInput, LoginInput } from '../api/auth.schema';

/**
 * Configuración de JWT
 */
const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_cambia_esto_en_produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Servicio de autenticación
 * Maneja la lógica de registro, login y generación de tokens JWT
 */
class AuthService {
  /**
   * Registra un nuevo usuario
   * @param email Email del usuario
   * @param password Contraseña en texto plano
   * @returns Usuario creado (sin contraseña)
   */
  async registerUser(email: string, password: string): Promise<Omit<User, 'passwordHash'>> {
    const client = await dbService.getClient();
    
    try {
      await client.query('BEGIN');

      // Verificar si el email ya existe
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('El email ya está registrado');
      }

      // Hashear la contraseña
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Crear el usuario
      const result = await client.query(
        `INSERT INTO users (email, password_hash) 
         VALUES ($1, $2) 
         RETURNING id, email, kyc_status, created_at`,
        [email.toLowerCase(), passwordHash]
      );

      await client.query('COMMIT');

      const user = result.rows[0];
      logger.info({ userId: user.id, email: user.email }, 'Usuario registrado exitosamente');

      return {
        id: user.id,
        email: user.email,
        kycStatus: user.kyc_status,
        createdAt: user.created_at
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(error, 'Error al registrar usuario');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Inicia sesión de usuario
   * @param email Email del usuario
   * @param password Contraseña en texto plano
   * @returns Token JWT y datos del usuario
   */
  async loginUser(email: string, password: string): Promise<{ token: string; user: Omit<User, 'passwordHash'> }> {
    const client = await dbService.getClient();
    
    try {
      // Buscar usuario por email
      const result = await client.query(
        `SELECT id, email, password_hash, kyc_status, created_at 
         FROM users 
         WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        throw new Error('Credenciales inválidas');
      }

      const user = result.rows[0];
      
      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isPasswordValid) {
        throw new Error('Credenciales inválidas');
      }

      // Generar token JWT
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          kycStatus: user.kyc_status
        },
        JWT_SECRET as string,
        { expiresIn: '24h' }
      );

      logger.info({ userId: user.id, email: user.email }, 'Usuario inició sesión exitosamente');

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          kycStatus: user.kyc_status,
          createdAt: user.created_at
        }
      };
    } catch (error) {
      logger.error(error, 'Error al iniciar sesión');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verifica un token JWT y devuelve los datos del usuario
   * @param token Token JWT
   * @returns Datos del usuario o null si el token es inválido
   */
  async verifyToken(token: string): Promise<{ userId: string; email: string; kycStatus: string } | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Verificar que el usuario aún existe en la base de datos
      const result = await dbService.query(
        'SELECT id, email, kyc_status FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        kycStatus: decoded.kycStatus
      };
    } catch (error) {
      logger.warn(error, 'Token JWT inválido o expirado');
      return null;
    }
  }

  /**
   * Hashea una contraseña
   * @param password Contraseña en texto plano
   * @returns Contraseña hasheada
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verifica una contraseña contra su hash
   * @param password Contraseña en texto plano
   * @param hash Hash de la contraseña
   * @returns True si la contraseña es válida
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
}

// Crear y exportar instancia del servicio
const authService = new AuthService();

export default authService;