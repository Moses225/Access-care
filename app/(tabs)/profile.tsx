import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { auth, db } from "../../firebase";

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ appointments: 0, questions: 0, saved: 0 });

  useEffect(() => {
    loadProfileImage();
    loadStats();
  }, []);

  const loadProfileImage = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfileImage(docSnap.data().profileImage || null);
      }
    } catch (error) {
      console.log('Error loading profile image:', error);
    }
  };

  const loadStats = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const [appointmentsSnap, questionsSnap, savedSnap] = await Promise.all([
        getDocs(query(collection(db, 'appointments'), where('userId', '==', uid))),
        getDocs(query(collection(db, 'questions'), where('userId', '==', uid))),
        getDocs(query(collection(db, 'savedProviders'), where('userId', '==', uid))),
      ]);

      setStats({
        appointments: appointmentsSnap.size,
        questions: questionsSnap.size,
        saved: savedSnap.size,
      });
    } catch (error) {
      console.log('Error loading stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadProfileImage(), loadStats()]);
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              Alert.alert("Error", "Failed to sign out");
            }
          }
        }
      ]
    );
  };

  const navigateTo = (path: string) => {
    router.push(path as any);
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={[styles.title, { color: colors.text }]}>My Profile</Text>

      <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => navigateTo('/profile/edit')}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {auth.currentUser?.email?.[0].toUpperCase() || "U"}
              </Text>
            </View>
          )}
          <Text style={[styles.editText, { color: colors.primary }]}>Tap to edit</Text>
        </TouchableOpacity>
        <Text style={[styles.email, { color: colors.subtext }]}>{auth.currentUser?.email}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.appointments}</Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>Appointments</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.questions}</Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>Questions</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.saved}</Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>Saved</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Healthcare</Text>
        <MenuItem label="Ask Questions (Q&A)" icon="💬" onPress={() => navigateTo('/qa/')} />
        <MenuItem label="My Appointments" icon="📅" onPress={() => navigateTo('/profile/appointments')} />
        <MenuItem label="Saved Providers" icon="⭐" onPress={() => navigateTo('/profile/saved')} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
        <MenuItem label="Insurance Information" icon="🏥" onPress={() => navigateTo('/profile/insurance')} />
        <MenuItem label="Payment Methods" icon="💳" onPress={() => navigateTo('/profile/payments')} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
        <MenuItem label="Theme" icon="🎨" onPress={() => navigateTo('/profile/theme')} />
        <MenuItem label="Notifications" icon="🔔" onPress={() => navigateTo('/profile/notifications')} />
        <MenuItem label="Privacy & Security" icon="🔒" onPress={() => navigateTo('/profile/privacy')} />
        <MenuItem label="Help & Support" icon="❓" onPress={() => navigateTo('/profile/help')} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Admin (Demo Only)</Text>
        <MenuItem 
          label="Answer Patient Questions" 
          icon="👨‍⚕️" 
          onPress={() => navigateTo('/admin/qa')} 
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
        <MenuItem 
          label="About AccessCare" 
          icon="ℹ️" 
          onPress={() => navigateTo('/about')} 
        />
      </View>

      <TouchableOpacity style={[styles.signOutButton, { backgroundColor: colors.error }]} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: colors.subtext }]}>AccessCare v1.0.0</Text>
      <Text style={[styles.pullRefresh, { color: colors.subtext }]}>Pull down to refresh</Text>
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function MenuItem({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  const { colors } = useTheme();
  
  return (
    <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Text style={styles.menuIcon}>{icon}</Text>
        <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <Text style={[styles.menuArrow, { color: colors.subtext }]}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 28, fontWeight: "bold", padding: 20, paddingTop: 60 },
  profileCard: { alignItems: "center", padding: 30, marginHorizontal: 20, borderRadius: 15, marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  avatarText: { fontSize: 40, fontWeight: "bold", color: "#fff" },
  editText: { fontSize: 12, marginBottom: 10 },
  email: { fontSize: 16 },
  statsContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 30, gap: 10 },
  statCard: { flex: 1, borderWidth: 2, borderRadius: 12, padding: 15, alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: 'bold', marginBottom: 5 },
  statLabel: { fontSize: 12, fontWeight: '500' },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", paddingHorizontal: 20, marginBottom: 15 },
  menuItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1 },
  menuLeft: { flexDirection: "row", alignItems: "center" },
  menuIcon: { fontSize: 20, marginRight: 15 },
  menuLabel: { fontSize: 16 },
  menuArrow: { fontSize: 24 },
  signOutButton: { marginHorizontal: 20, padding: 18, borderRadius: 12, alignItems: "center", marginBottom: 10 },
  signOutText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  version: { textAlign: "center", fontSize: 12, marginBottom: 5 },
  pullRefresh: { textAlign: "center", fontSize: 11, marginBottom: 20 },
  bottomPadding: { height: 40 },
});