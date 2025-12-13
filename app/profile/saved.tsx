import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { auth, db } from "../../firebase";

type SavedProviderRecord = {
  userId: string;
  name: string;
  specialty: string;
};

export type SavedProvider = SavedProviderRecord & { id: string };

export default function SavedProvidersScreen() {
  const [providers, setProviders] = useState<SavedProvider[]>([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(collection(db, "savedProviders"), where("userId", "==", uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: SavedProvider[] = snapshot.docs.map((d) => {
        const record = d.data() as SavedProviderRecord;
        return { id: d.id, ...record };
      });
      setProviders(data);
    });

    return unsubscribe;
  }, []);

  const removeProvider = async (id: string) => {
    await deleteDoc(doc(db, "savedProviders", id));
    Alert.alert("Removed", "Provider has been removed from your saved list.");
  };

  return (
    <View style={styles.container}>
      <FlatList<SavedProvider>
        data={providers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.specialty}>{item.specialty}</Text>
            <TouchableOpacity onPress={() => removeProvider(item.id)}>
              <Text style={styles.remove}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No saved providers.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  empty: { fontSize: 16, color: "#999", textAlign: "center", marginTop: 50 },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  name: { fontSize: 16, fontWeight: "bold", color: "#333" },
  specialty: { fontSize: 14, color: "#667eea" },
  remove: { fontSize: 14, color: "#ff4444", marginTop: 10 },
});