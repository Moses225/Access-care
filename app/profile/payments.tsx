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
  Button,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebase";

type PaymentMethodRecord = {
  userId: string;
  cardNumber: string;
};

export type PaymentMethod = PaymentMethodRecord & { id: string };

export default function PaymentsScreen() {
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
    <View style={styles.container}>
      <Text style={styles.title}>Add Payment Method</Text>
      <Text style={styles.note}>Note: This is just a demo for the final project.</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Card Number (Last 4 digits for demo)"
        placeholderTextColor="#999"
        value={cardNumber}
        onChangeText={setCardNumber}
        keyboardType="number-pad"
        maxLength={16}
      />
      <Button title="Add Payment Method" onPress={addPaymentMethod} />

      <Text style={styles.subtitle}>Saved Cards</Text>

      <FlatList
        data={methods}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.text}>
              💳 Card ending in {item.cardNumber?.slice(-4) || "••••"}
            </Text>
            <TouchableOpacity onPress={() => removePaymentMethod(item.id)}>
              <Text style={styles.remove}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No payment methods saved.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  note: { fontSize: 12, color: '#ff9800', marginBottom: 15, fontStyle: 'italic' },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 30, marginBottom: 15, color: '#333' },
  input: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: '#f0f0ff',
    borderRadius: 10,
    marginBottom: 10,
  },
  text: { fontSize: 16, color: "#333" },
  remove: { color: "#ff4444", fontWeight: "bold" },
  empty: { fontSize: 16, color: "#999", textAlign: "center", marginTop: 30 },
});