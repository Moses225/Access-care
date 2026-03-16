import { z } from 'zod';

// ─── Password strength schema (reused across signup) ──────────────────────────
// Requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    'Password must contain at least one special character (!@#$%...)'
  );

// ─── Phone number validation (US format: 10 digits) ───────────────────────────
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .regex(/^\d{10}$/, 'Phone must be exactly 10 digits');

// ─── Email validation ─────────────────────────────────────────────────────────
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format');

// ─── Date validation (YYYY-MM-DD) ─────────────────────────────────────────────
export const dateSchema = z
  .string()
  .min(1, 'Date is required')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format');

// ─── Time validation (HH:MM) ──────────────────────────────────────────────────
export const timeSchema = z
  .string()
  .min(1, 'Time is required')
  .regex(/^\d{2}:\d{2}$/, 'Invalid time format');

// ─── Booking form validation ──────────────────────────────────────────────────
export const bookingSchema = z.object({
  patientName: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long'),

  patientPhone: phoneSchema,

  date: dateSchema,

  time: timeSchema,

  notes: z
    .string()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),
});

// ─── User profile validation ──────────────────────────────────────────────────
export const userProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name too long'),

  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name too long'),

  email: emailSchema,

  phone: phoneSchema.optional(),

  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal('')),
});

// ─── Auth validation schemas ──────────────────────────────────────────────────
export const loginSchema = z.object({
  email: emailSchema,
  // Login only checks presence — don't reveal password rules to attackers
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ─── Sanitization helpers ─────────────────────────────────────────────────────

// Sanitize general text input (strip injection vectors)
export const sanitizeText = (text: string): string => {
  if (!text) return '';
  return text
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
};

// Sanitize email (lowercase and trim)
export const sanitizeEmail = (email: string): string => {
  if (!email) return '';
  return email.trim().toLowerCase();
};

// Sanitize phone (keep only digits)
export const sanitizePhone = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

// ─── Validation runners ───────────────────────────────────────────────────────

export const validateBooking = (data: unknown) => {
  try {
    bookingSchema.parse(data);
    return { valid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0].toString()] = issue.message;
        }
      });
      return { valid: false, errors };
    }
    return { valid: false, errors: { general: 'Validation failed' } };
  }
};

export const validateLogin = (data: unknown) => {
  try {
    loginSchema.parse(data);
    return { valid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0].toString()] = issue.message;
        }
      });
      return { valid: false, errors };
    }
    return { valid: false, errors: { general: 'Validation failed' } };
  }
};

export const validateSignup = (data: unknown) => {
  try {
    signupSchema.parse(data);
    return { valid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0].toString()] = issue.message;
        }
      });
      return { valid: false, errors };
    }
    return { valid: false, errors: { general: 'Validation failed' } };
  }
};
