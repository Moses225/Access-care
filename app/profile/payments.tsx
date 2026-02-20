import { useRouter } from 'expo-router';
import {
  addDoc,
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from "../../firebase";

type PaymentMethodRecord = {
  userId: string;
  cardNumber: string;
};

export type PaymentMethod = PaymentMethodRecord & { id: string };

export default function PaymentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [cardNumber, setCardNumber] = useState("");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(collection(db, "paymentMethods"), where("userId", "==", uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: PaymentMethod[] = snapshot.docs.map((d) => {
        const record = d.data() as PaymentMethodRecord;
        return { id: d.id, ...record };
      });
      setMethods(data);
    });

    return unsubscribe;
  }, []);

  const addPaymentMethod = async () => {
    if (!cardNumber || cardNumber.length < 4) {
      Alert.alert("Error", "Enter a valid card number (at least 4 digits)");
      return;
    }
    if (!auth.currentUser?.uid) return;

    await addDoc(collection(db, "paymentMethods"), {
      userId: auth.currentUser.uid,
      cardNumber,
    });

    setCardNumber("");
    Alert.alert("Added", "Payment method saved.");
  };

  const removePaymentMethod = async (id: string) => {
    Alert.alert(
      "Remove Card",
      "Are you sure you want to remove this payment method?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "paymentMethods", id));
            Alert.alert("Removed", "Payment method deleted.");
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Payment Methods</Text>
        <Text style={[styles.note, { color: colors.warning }]}>Note: This is just a demo for the beta.</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Add Payment Method</Text>
          
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Card Number (Last 4 digits for demo)"
            placeholderTextColor={colors.subtext}
            value={cardNumber}
            onChangeText={setCardNumber}
            keyboardType="number-pad"
            maxLength={16}
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={addPaymentMethod}
          >
            <Text style={styles.buttonText}>Add Payment Method</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Saved Cards</Text>

          <FlatList
            data={methods}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.background }]}>
                <Text style={[styles.text, { color: colors.text }]}>
                  💳 Card ending in {item.cardNumber?.slice(-4) || "••••"}
                </Text>
                <TouchableOpacity onPress={() => removePaymentMethod(item.id)}>
                  <Text style={[styles.remove, { color: colors.error }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.subtext }]}>No payment methods saved.</Text>
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 5,
  },
  note: { 
    fontSize: 12, 
    marginBottom: 5, 
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
  },
  section: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  subtitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 15,
  },
  input: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  text: { fontSize: 16 },
  remove: { fontWeight: "bold" },
  empty: { fontSize: 16, textAlign: "center", marginTop: 30 },
});