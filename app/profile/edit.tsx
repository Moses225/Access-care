import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GuestUpgradePrompt } from '../../components/GuestUpgradePrompt';
import { auth, db, storage } from '../../firebase';

const BIOLOGICAL_SEX_OPTIONS = ['Male', 'Female', 'Intersex', 'Prefer not to say'];

const GENDER_IDENTITY_OPTIONS = [
  'Man', 'Woman', 'Non-binary',
  'Transgender Man', 'Transgender Woman',
  'Genderqueer', 'Prefer not to say', 'Other',
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isGuest } = useAuth();

  // ── Profile image ──────────────────────────────────────────────────────────
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [hasExistingImage, setHasExistingImage] = useState(false);

  // ── Profile info ───────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [biologicalSex, setBiologicalSex] = useState('');
  const [genderIdentity, setGenderIdentity] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    if (!isGuest) loadProfile();
  }, [isGuest]);

  const loadProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      setEmail(user.email || '');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setPhone(data.phone || '');
        setBiologicalSex(data.biologicalSex || '');
        setGenderIdentity(data.genderIdentity || '');
        if (data.profileImage) {
          setProfileImage(data.profileImage);
          setSelectedImage(data.profileImage);
          setHasExistingImage(true);
        }
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading profile:', error);
    }
  };

  const saveProfileInfo = async () => {
    if (!firstName.trim()) { Alert.alert('Required', 'Please enter your first name.'); return; }
    if (!lastName.trim()) { Alert.alert('Required', 'Please enter your last name.'); return; }

    setSavingInfo(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const updateData: Record<string, any> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        updatedAt: new Date().toISOString(),
      };

      if (phone.trim()) updateData.phone = phone.trim();
      if (biologicalSex) updateData.biologicalSex = biologicalSex;
      if (genderIdentity) updateData.genderIdentity = genderIdentity;

      await setDoc(doc(db, 'users', user.uid), updateData, { merge: true });

      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      if (__DEV__) console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSavingInfo(false);
    }
  };

  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your photos'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5,
    });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your camera'); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5,
    });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  };

  const deletePhoto = async () => {
    Alert.alert('Delete Photo', 'Are you sure you want to remove your profile picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            setUploading(true);
            const user = auth.currentUser;
            if (!user) return;
            if (hasExistingImage) {
              try { await deleteObject(ref(storage, `profileImages/${user.uid}`)); }
              catch { if (__DEV__) console.log('No image to delete in storage'); }
            }
            await updateDoc(doc(db, 'users', user.uid), { profileImage: null });
            setProfileImage(null); setSelectedImage(null); setHasExistingImage(false);
            Alert.alert('Removed', 'Profile picture removed.');
          } catch { Alert.alert('Error', 'Failed to delete image'); }
          finally { setUploading(false); }
        },
      },
    ]);
  };

  const savePhoto = async () => {
    if (!selectedImage || selectedImage === profileImage) return;
    try {
      setUploading(true);
      const user = auth.currentUser;
      if (!user) return;
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const imageRef = ref(storage, `profileImages/${user.uid}`);
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);
      await setDoc(doc(db, 'users', user.uid), { profileImage: downloadURL }, { merge: true });
      setProfileImage(downloadURL); setHasExistingImage(true);
      Alert.alert('Saved', 'Profile picture updated!');
    } catch { Alert.alert('Error', 'Failed to upload image. Please try again.'); }
    finally { setUploading(false); }
  };

  if (isGuest) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: colors.card }]}>
            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
              <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Edit Profile</Text>
          </View>
          <View style={styles.guestWall}>
            <Text style={styles.guestIcon}>🔒</Text>
            <Text style={[styles.guestTitle, { color: colors.text }]}>Account Required</Text>
            <Text style={[styles.guestText, { color: colors.subtext }]}>
              Create a free account to edit your profile.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowUpgradePrompt(true)}
            >
              <Text style={styles.primaryButtonText}>Create Free Account</Text>
            </TouchableOpacity>
          </View>
          <GuestUpgradePrompt visible={showUpgradePrompt} onClose={() => setShowUpgradePrompt(false)} reason="edit your profile" />
        </View>
      </>
    );
  }

  const photoChanged = selectedImage && selectedImage !== profileImage;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Edit Profile</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* ── Profile picture ─────────────────────────────────────── */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Picture</Text>
            <View style={styles.avatarRow}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.profileImage} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarInitials}>
                    {firstName ? firstName.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
              )}
              <View style={styles.photoButtons}>
                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.primary }]} onPress={pickImageFromGallery} disabled={uploading}>
                  <Text style={styles.photoBtnText}>📷 Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.primary }]} onPress={takePhoto} disabled={uploading}>
                  <Text style={styles.photoBtnText}>📸 Camera</Text>
                </TouchableOpacity>
                {hasExistingImage && (
                  <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.error }]} onPress={deletePhoto} disabled={uploading}>
                    <Text style={styles.photoBtnText}>🗑️ Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {photoChanged && (
              <TouchableOpacity
                style={[styles.savePhotoBtn, { backgroundColor: colors.success, opacity: uploading ? 0.7 : 1 }]}
                onPress={savePhoto} disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.savePhotoBtnText}>✅ Save Photo</Text>
                }
              </TouchableOpacity>
            )}
          </View>

          {/* ── Personal information ─────────────────────────────────── */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>

            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <Text style={[styles.inputLabel, { color: colors.subtext }]}>First Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="First Name" placeholderTextColor={colors.subtext}
                  value={firstName} onChangeText={setFirstName}
                  autoCapitalize="words" autoCorrect={false}
                />
              </View>
              <View style={styles.nameField}>
                <Text style={[styles.inputLabel, { color: colors.subtext }]}>Last Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="Last Name" placeholderTextColor={colors.subtext}
                  value={lastName} onChangeText={setLastName}
                  autoCapitalize="words" autoCorrect={false}
                />
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="(555) 000-0000" placeholderTextColor={colors.subtext}
              value={phone} onChangeText={setPhone} keyboardType="phone-pad"
            />
            <Text style={[styles.inputHint, { color: colors.subtext }]}>
              Used to pre-fill appointment booking forms
            </Text>

            {/* Email read-only */}
            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Email Address</Text>
            <View style={[styles.readOnlyField, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.readOnlyText, { color: colors.subtext }]}>{email}</Text>
              <Text style={[styles.readOnlyBadge, { color: colors.subtext }]}>Cannot be changed</Text>
            </View>
          </View>

          {/* ── Health information ───────────────────────────────────── */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Health Information</Text>
            <Text style={[styles.sectionHint, { color: colors.subtext }]}>
              Used for clinical context. All fields are optional.
            </Text>

            {/* Biological sex */}
            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Biological Sex</Text>
            <View style={styles.chipRow}>
              {BIOLOGICAL_SEX_OPTIONS.map((option) => {
                const isSelected = biologicalSex === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, {
                      backgroundColor: isSelected ? colors.primary : colors.background,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }]}
                    onPress={() => setBiologicalSex(isSelected ? '' : option)}
                  >
                    <Text style={[styles.chipText, { color: isSelected ? '#fff' : colors.text }]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Gender identity */}
            <Text style={[styles.inputLabel, { color: colors.subtext, marginTop: 8 }]}>Gender Identity</Text>
            <View style={styles.chipRow}>
              {GENDER_IDENTITY_OPTIONS.map((option) => {
                const isSelected = genderIdentity === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, {
                      backgroundColor: isSelected ? colors.primary : colors.background,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }]}
                    onPress={() => setGenderIdentity(isSelected ? '' : option)}
                  >
                    <Text style={[styles.chipText, { color: isSelected ? '#fff' : colors.text }]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveInfoBtn, { backgroundColor: colors.primary, opacity: savingInfo ? 0.7 : 1 }]}
            onPress={saveProfileInfo} disabled={savingInfo}
          >
            {savingInfo
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveInfoBtnText}>Save Changes</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backText: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold' },
  scrollContent: { padding: 16 },
  section: { borderRadius: 16, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sectionHint: { fontSize: 12, marginBottom: 16, lineHeight: 18 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  profileImage: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  photoButtons: { flex: 1, gap: 8 },
  photoBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  photoBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  savePhotoBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  savePhotoBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  nameRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  nameField: { flex: 1 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 13, fontSize: 15, marginBottom: 14 },
  inputHint: { fontSize: 11, marginTop: -10, marginBottom: 14, paddingHorizontal: 2 },
  readOnlyField: {
    borderWidth: 1.5, borderRadius: 10, padding: 13, marginBottom: 4,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  readOnlyText: { fontSize: 15 },
  readOnlyBadge: { fontSize: 11 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  saveInfoBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 8 },
  saveInfoBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  guestWall: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  guestIcon: { fontSize: 64, marginBottom: 20 },
  guestTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  guestText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  primaryButton: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
