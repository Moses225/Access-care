import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// ─── Audit log entry types ────────────────────────────────────────────────────
// Every sensitive operation in the app writes an immutable audit log entry.
// These are write-only for regular users and readable only by admins.
// Required for HIPAA compliance — covered entities must maintain audit logs
// of all PHI access and modification.

export type AuditAction =
  // Booking lifecycle
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_declined'
  | 'booking_cancelled_patient'
  | 'booking_cancelled_provider'
  | 'booking_completed'
  // Profile & account
  | 'profile_updated'
  | 'insurance_updated'
  | 'dependent_added'
  | 'dependent_updated'
  | 'dependent_deleted'
  // Provider portal
  | 'provider_profile_updated'
  | 'provider_login'
  // Auth
  | 'account_created'
  | 'password_reset_requested';

export type AuditActorType = 'patient' | 'provider' | 'admin' | 'system';

export interface AuditLogEntry {
  action: AuditAction;
  actorUid: string;
  actorType: AuditActorType;
  targetId?: string;        // bookingId, userId, providerId, etc.
  targetCollection?: string; // 'bookings', 'users', 'providers', etc.
  previousStatus?: string;
  newStatus?: string;
  metadata?: Record<string, any>; // Additional context — never include PII
  timestamp: any;           // serverTimestamp()
  appVersion?: string;
}

// ─── Write an audit log entry ─────────────────────────────────────────────────
// Fire and forget — audit logging failure should never block the main operation.
// Always call this AFTER the main Firestore write succeeds.
export async function writeAuditLog(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
  try {
    await addDoc(collection(db, 'auditLog'), {
      ...entry,
      // Never log PII in metadata — only IDs, statuses, and action types
      metadata: sanitizeMetadata(entry.metadata),
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    // Non-critical — log failure silently, never surface to user
    if (__DEV__) console.warn('[AuditLog] Write failed (non-critical):', error);
  }
}

// ─── Scrub any accidental PII from metadata before logging ───────────────────
const PII_KEYS = [
  'email', 'phone', 'patientName', 'patientPhone', 'name',
  'firstName', 'lastName', 'address', 'dateOfBirth', 'policyNumber',
  'guardianName', 'guardianPhone', 'notes', 'reasonForVisit',
];

function sanitizeMetadata(
  metadata?: Record<string, any>
): Record<string, any> | undefined {
  if (!metadata) return undefined;
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (PII_KEYS.includes(key.toLowerCase())) {
      clean[key] = '[redacted]';
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export function logBookingCreated(
  actorUid: string,
  bookingId: string,
  providerId: string,
  visitType: string
) {
  return writeAuditLog({
    action: 'booking_created',
    actorUid,
    actorType: 'patient',
    targetId: bookingId,
    targetCollection: 'bookings',
    metadata: { providerId, visitType },
  });
}

export function logBookingConfirmed(
  actorUid: string,
  bookingId: string,
  providerId: string
) {
  return writeAuditLog({
    action: 'booking_confirmed',
    actorUid,
    actorType: 'provider',
    targetId: bookingId,
    targetCollection: 'bookings',
    previousStatus: 'pending',
    newStatus: 'confirmed',
    metadata: { providerId },
  });
}

export function logBookingDeclined(
  actorUid: string,
  bookingId: string,
  providerId: string,
  reasonCategory: string
) {
  return writeAuditLog({
    action: 'booking_declined',
    actorUid,
    actorType: 'provider',
    targetId: bookingId,
    targetCollection: 'bookings',
    previousStatus: 'pending',
    newStatus: 'cancelled',
    // Log the reason category only — not the free-text reason which may contain PII
    metadata: { providerId, reasonCategory },
  });
}

export function logBookingCancelledByPatient(
  actorUid: string,
  bookingId: string,
  cancelReasonId: string
) {
  return writeAuditLog({
    action: 'booking_cancelled_patient',
    actorUid,
    actorType: 'patient',
    targetId: bookingId,
    targetCollection: 'bookings',
    previousStatus: 'pending',
    newStatus: 'cancelled',
    metadata: { cancelReasonId },
  });
}

export function logInsuranceUpdated(actorUid: string) {
  return writeAuditLog({
    action: 'insurance_updated',
    actorUid,
    actorType: 'patient',
    targetId: actorUid,
    targetCollection: 'insurance',
  });
}

export function logProviderProfileUpdated(
  actorUid: string,
  providerId: string
) {
  return writeAuditLog({
    action: 'provider_profile_updated',
    actorUid,
    actorType: 'provider',
    targetId: providerId,
    targetCollection: 'providers',
  });
}

export function logDependentAdded(actorUid: string, dependentId: string) {
  return writeAuditLog({
    action: 'dependent_added',
    actorUid,
    actorType: 'patient',
    targetId: dependentId,
    targetCollection: 'users/dependents',
  });
}

export function logDependentDeleted(actorUid: string, dependentId: string) {
  return writeAuditLog({
    action: 'dependent_deleted',
    actorUid,
    actorType: 'patient',
    targetId: dependentId,
    targetCollection: 'users/dependents',
  });
}
