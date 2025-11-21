/**
 * Input validation schemas for authentication endpoints
 * Uses Zod for runtime type checking and validation
 */

import { z } from 'zod'

/**
 * Email validation schema
 * - Must be valid email format
 * - Normalized to lowercase
 * - Max length 255 characters
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .transform((email) => email.toLowerCase().trim())

/**
 * Password validation schema
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - Must contain at least one uppercase letter
 * - Must contain at least one lowercase letter
 * - Must contain at least one number
 * - Must contain at least one special character
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

/**
 * Signup request validation schema
 */
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema
})

/**
 * Login request validation schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
})

/**
 * Refresh token validation schema
 */
export const refreshSchema = z.object({
  refreshToken: z.string().optional() // Can also come from cookie
})

// Export types for use in route handlers
export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
