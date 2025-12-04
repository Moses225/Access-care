import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase';

export default function HomeScreen() {
  const router = useRouter();

  const handleSignOut = async () => {
  try {
    // Navigate FIRST, then sign out
    router.replace('/');
    
    // Small delay to let navigation start
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Then sign out
    await signOut(auth);
  } catch (error) {
    Alert.alert('Error', 'Failed to sign out');
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🤰 Welcome to AccessCare!</Text>
      <Text style={styles.subtitle}>You're successfully logged in!</Text>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>👤 User Email:</Text>
        <Text style={styles.email}>{auth.currentUser?.email}</Text>
      </View>

      <TouchableOpacity 
        style={styles.signOutButton}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#667eea',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  infoBox: {
    backgroundColor: '#f0f0ff',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    marginBottom: 30,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  signOutButton: {
    backgroundColor: '#ff4444',
    padding: 15,
    borderRadius: 10,
    width: '100%',
  },
  signOutText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});