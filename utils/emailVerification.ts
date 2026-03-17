import { Alert } from 'react-native';
import { sendEmailVerification, reload } from 'firebase/auth';
import { auth } from '../firebase';

// ─── Email verification enforcement ───────────────────────────────────────────
// Soft enforcement: warn unverified users but allow booking during beta.
// Set HARD_ENFORCE = true before public App Store launch to block unverified
// users from completing bookings.
const HARD_ENFORCE = true;

export type VerificationCheckResult = {
  canProceed: boolean;
  isVerified: boolean;
};

// Check if the current user's email is verified.
// Reloads the auth token to get the latest verification status.
export async function checkEmailVerification(): Promise<VerificationCheckResult> {
  try {
    const user = auth.currentUser;
    if (!user) return { canProceed: false, isVerified: false };

    // Anonymous users don't have email verification
    if (user.isAnonymous) return { canProceed: false, isVerified: false };

    // Reload to get latest emailVerified status from server
    await reload(user);

    const isVerified = auth.currentUser?.emailVerified ?? false;

    if (isVerified) return { canProceed: true, isVerified: true };

    // Not verified — show warning
    return { canProceed: !HARD_ENFORCE, isVerified: false };
  } catch {
    // If reload fails, fail open during beta
    return { canProceed: true, isVerified: false };
  }
}

// Show a prompt asking the user to verify their email.
// Returns true if user chose to resend the verification email.
export function showVerificationPrompt(onResend?: () => void): void {
  Alert.alert(
    'Email Not Verified',
    HARD_ENFORCE
      ? 'You must verify your email address before booking. Check your inbox for a verification link.'
      : 'Your email address has not been verified. Please check your inbox for a verification link. You can still book for now, but this will be required after launch.',
    [
      {
        text: 'Resend Email',
        onPress: async () => {
          try {
            const user = auth.currentUser;
            if (user) {
              await sendEmailVerification(user);
              Alert.alert('Sent', 'Verification email sent. Check your inbox.');
            }
          } catch (error: any) {
            if (error?.code === 'auth/too-many-requests') {
              Alert.alert('Try Later', 'Too many verification emails sent. Please wait a few minutes.');
            } else {
              Alert.alert('Error', 'Could not send verification email. Try again later.');
            }
          }
          onResend?.();
        },
      },
      { text: HARD_ENFORCE ? 'Cancel' : 'Continue Anyway', style: 'cancel' },
    ]
  );
}
