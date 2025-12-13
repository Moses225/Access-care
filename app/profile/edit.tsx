import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { auth, db, storage } from '../../firebase';

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadCurrentImage();
  }, []);

  const loadCurrentImage = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const docRef = doc(db, 'users', uid);
      const snapshot = await (await import('firebase/firestore')).getDoc(docRef);
      if (snapshot.exists() && snapshot.data().profileImage) {
        setSelectedImage(snapshot.data().profileImage);
      }
    } catch (error) {
      console.log('Error loading image:', error);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to select a photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.log('Image picker error:', error);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera permissions to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      console.log('Camera error:', error);
    }
  };

  const uploadImage = async () => {
    if (!selectedImage) {
      Alert.alert('No Image', 'Please select an image first');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    setUploading(true);

    try {
      // Convert image to blob
      const response = await fetch(selectedImage);
      const blob = await response.blob();

      // Create unique filename
      const filename = `profile-${uid}-${Date.now()}.jpg`;
      const storageRef = ref(storage, `profile-images/${uid}/${filename}`);

      // Upload to Firebase Storage
      await uploadBytes(storageRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Save URL to Firestore
      await setDoc(doc(db, 'users', uid), { profileImage: downloadURL }, { merge: true });

      Alert.alert('Success', 'Profile picture updated!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Could not upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Edit Profile Picture</Text>

      <View style={styles.imageContainer}>
        {selectedImage ? (
          <Image source={{ uri: selectedImage }} style={styles.image} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: colors.card }]}>
            <Text style={[styles.placeholderText, { color: colors.subtext }]}>No image selected</Text>
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={pickImageFromGallery}
        disabled={uploading}
      >
        <Text style={styles.buttonText}>📷 Choose from Gallery</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={takePhoto}
        disabled={uploading}
      >
        <Text style={styles.buttonText}>📸 Take Photo</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[
          styles.saveButton, 
          { backgroundColor: colors.success },
          uploading && { backgroundColor: colors.border }
        ]}
        onPress={uploadImage}
        disabled={uploading || !selectedImage}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {selectedImage ? '✅ Save Picture' : 'Select an image first'}
          </Text>
        )}
      </TouchableOpacity>

      {uploading && (
        <Text style={[styles.uploadingText, { color: colors.subtext }]}>
          Uploading... Please wait
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  imageContainer: { alignItems: 'center', marginBottom: 30 },
  image: { width: 200, height: 200, borderRadius: 100, borderWidth: 3, borderColor: '#667eea' },
  placeholder: { 
    width: 200, 
    height: 200, 
    borderRadius: 100, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  placeholderText: { fontSize: 14 },
  button: { 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginBottom: 15 
  },
  saveButton: { 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 10 
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  uploadingText: { 
    textAlign: 'center', 
    marginTop: 10, 
    fontSize: 14,
    fontStyle: 'italic',
  },
});