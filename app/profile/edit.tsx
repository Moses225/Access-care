import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GuestUpgradePrompt } from '../../components/GuestUpgradePrompt';
import { auth, db, storage } from '../../firebase';

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isGuest } = useAuth();

  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [hasExistingImage, setHasExistingImage] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    if (!isGuest) loadProfileImage();
  }, [isGuest]);

  const loadProfileImage = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().profileImage) {
        setProfileImage(userDoc.data().profileImage);
        setSelectedImage(userDoc.data().profileImage);
        setHasExistingImage(true);
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading profile image:', error);
    }
  };

  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your camera');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  };

  const deletePhoto = async () => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploading(true);
              const user = auth.currentUser;
              if (!user) return;

              if (hasExistingImage) {
                try {
                  const imageRef = ref(storage, `profileImages/${user.uid}`);
                  await deleteObject(imageRef);
                } catch {
                  if (__DEV__) console.log('No image to delete in storage');
                }
              }

              await updateDoc(doc(db, 'users', user.uid), { profileImage: null });
              setProfileImage(null);
              setSelectedImage(null);
              setHasExistingImage(false);

              Alert.alert('Success', 'Profile picture removed', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              if (__DEV__) console.error('Error deleting image:', error);
              Alert.alert('Error', 'Failed to delete image');
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  const savePicture = async () => {
    if (!selectedImage) {
      Alert.alert('No image selected', 'Please choose or take a photo first');
      return;
    }
    if (selectedImage === profileImage) {
      router.back();
      return;
    }

    try {
      setUploading(true);
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to upload a profile picture');
        return;
      }

      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const imageRef = ref(storage, `profileImages/${user.uid}`);
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);

      await setDoc(doc(db, 'users', user.uid), { profileImage: downloadURL }, { merge: true });

      setProfileImage(downloadURL);
      setHasExistingImage(true);

      Alert.alert('Success', 'Profile picture updated!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      if (__DEV__) console.error('Error uploading image:', error);
      if (error.code === 'storage/unauthorized') {
        Alert.alert('Permission Error', 'Unable to upload image. Please check Firebase Storage rules.');
      } else {
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  // ─── Guest wall ────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Edit Profile Picture</Text>
          </View>

          <View style={styles.imageContainer}>
            <View style={[styles.placeholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.placeholderText}>🔒</Text>
            </View>
          </View>

          <View style={styles.buttonsContainer}>
            <Text style={{ color: colors.subtext, textAlign: 'center', marginBottom: 16, fontSize: 15, lineHeight: 22 }}>
              Create a free account to set your profile picture and personalize your experience.
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowUpgradePrompt(true)}
              accessibilityLabel="Create account to edit profile"
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Create Free Account</Text>
            </TouchableOpacity>
          </View>

          <GuestUpgradePrompt
            visible={showUpgradePrompt}
            onClose={() => setShowUpgradePrompt(false)}
            reason="edit your profile"
          />
        </View>
      </>
    );
  }

  // ─── Full account ──────────────────────────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]}>Edit Profile Picture</Text>
        </View>

        <View style={styles.imageContainer}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.profileImage} />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.placeholderText}>📷</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={pickImageFromGallery}
            disabled={uploading}
            accessibilityLabel="Choose from gallery"
            accessibilityRole="button"
          >
            <Text style={styles.buttonIcon}>📷</Text>
            <Text style={styles.buttonText}>Choose from Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={takePhoto}
            disabled={uploading}
            accessibilityLabel="Take a photo"
            accessibilityRole="button"
          >
            <Text style={styles.buttonIcon}>📸</Text>
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>

          {hasExistingImage && (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: colors.error }]}
              onPress={deletePhoto}
              disabled={uploading}
              accessibilityLabel="Delete profile photo"
              accessibilityRole="button"
            >
              <Text style={styles.buttonIcon}>🗑️</Text>
              <Text style={styles.buttonText}>Delete Photo</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.success }]}
            onPress={savePicture}
            disabled={uploading || !selectedImage}
            accessibilityLabel="Save profile picture"
            accessibilityRole="button"
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonIcon}>✅</Text>
                <Text style={styles.buttonText}>Save Picture</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  backText: { fontSize: 16, fontWeight: '600' },
  titleContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: 'bold' },
  imageContainer: { alignItems: 'center', marginBottom: 60 },
  profileImage: { width: 200, height: 200, borderRadius: 100 },
  placeholder: {
    width: 200, height: 200, borderRadius: 100,
    justifyContent: 'center', alignItems: 'center',
  },
  placeholderText: { fontSize: 80 },
  buttonsContainer: { paddingHorizontal: 20, gap: 16 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', padding: 20, borderRadius: 16, gap: 12,
  },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', padding: 20, borderRadius: 16, gap: 12,
  },
  saveButton: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', padding: 20, borderRadius: 16, gap: 12,
  },
  buttonIcon: { fontSize: 24 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
