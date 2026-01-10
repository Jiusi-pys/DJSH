/**
 * Zod schemas for authentication data validation
 * These schemas provide runtime type checking to prevent type errors
 */

import { z } from 'zod';

// User role schema
export const userRoleSchema = z.enum(['admin', 'user']);

// User status schema
export const userStatusSchema = z.enum(['active', 'locked', 'disabled']);

// User schema
export const userSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(1),
  role: userRoleSchema,
  displayName: z.string().min(1),
  status: userStatusSchema.optional(),
  lastLoginAt: z.string().optional(),
  lastLoginIP: z.string().optional(),
  createdAt: z.string().optional(),
});

// Login response schema
export const loginResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    user: userSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number(),
  }).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  attemptsRemaining: z.number().optional(),
  locked: z.boolean().optional(),
  lockDuration: z.number().optional(),
  remainingTime: z.number().optional(),
});

// Auth check response schema (from /auth/me)
export const authCheckResponseSchema = z.object({
  success: z.boolean(),
  data: userSchema.optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// Refresh token response schema
export const refreshResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    accessToken: z.string(),
    expiresIn: z.number(),
  }).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// Type exports
export type UserSchema = z.infer<typeof userSchema>;
export type LoginResponseSchema = z.infer<typeof loginResponseSchema>;
export type AuthCheckResponseSchema = z.infer<typeof authCheckResponseSchema>;
export type RefreshResponseSchema = z.infer<typeof refreshResponseSchema>;
