import { Stack } from 'expo-router';
import { ProviderAuthProvider } from '../../context/ProviderAuthContext';

export default function ProviderPortalLayout() {
  return (
    <ProviderAuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ProviderAuthProvider>
  );
}
