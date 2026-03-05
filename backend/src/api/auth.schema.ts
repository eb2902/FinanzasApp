import { z } from 'zod';

/**
 * Esquema de validación para el registro de usuario
 */
export const registerSchema = z.object({
  email: z
    .string()
    .email('Formato de email inválido')
    .min(1, 'El email es requerido'),
  
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede exceder 128 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
    )
});

/**
 * Esquema de validación para el login de usuario
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Formato de email inválido')
    .min(1, 'El email es requerido'),
  
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
});

/**
 * Tipos inferidos de los esquemas
 */
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;