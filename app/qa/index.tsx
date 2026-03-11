import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { GuestUpgradePrompt } from '../../components/GuestUpgradePrompt';
import { auth, db } from '../../firebase';

type Question = {
  id: string;
  userId: string;
  question: string;
  answer?: string;
  createdAt: Date;
  answeredAt?: Date;
};

export default function QAScreen() {
  const { colors } = useTheme();
  const { isGuest } = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    if (isGuest) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(
      collection(db, 'questions'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        answeredAt: doc.data().answeredAt?.toDate(),
      })) as Question[];
      setQuestions(data);
    });

    return unsubscribe;
  }, [isGuest]);

  const askQuestion = async () => {
    if (!newQuestion.trim()) { Alert.alert('Error', 'Please enter a question'); return; }

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    await addDoc(collection(db, 'questions'), {
      userId: uid,
      question: newQuestion,
      createdAt: serverTimestamp(),
    });

    setNewQuestion('');
    Alert.alert('Submitted', 'Your question has been submitted. A healthcare professional will answer soon.');
  };

  // ─── Guest wall ────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>Ask Questions</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Get answers from healthcare professionals
          </Text>
        </View>
        <View style={styles.guestWall}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.guestWallTitle, { color: colors.text }]}>Account Required</Text>
          <Text style={[styles.guestWallText, { color: colors.subtext }]}>
            Create a free account to ask questions and get answers from healthcare professionals.
          </Text>
          <TouchableOpacity
            style={[styles.createAccountButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowUpgradePrompt(true)}
            accessibilityRole="button"
          >
            <Text style={styles.createAccountButtonText}>Create Free Account</Text>
          </TouchableOpacity>
        </View>
        <GuestUpgradePrompt
          visible={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          reason="ask questions"
        />
      </View>
    );
  }

  // ─── Full account ──────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>Ask Questions</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          Get answers from healthcare professionals
        </Text>
      </View>

      <View style={[styles.inputSection, { borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="What would you like to know?"
          placeholderTextColor={colors.subtext}
          value={newQuestion}
          onChangeText={setNewQuestion}
          multiline
          accessibilityLabel="Ask a question"
        />
        <TouchableOpacity
          style={[styles.askButton, { backgroundColor: colors.primary }]}
          onPress={askQuestion}
          accessibilityRole="button"
        >
          <Text style={styles.askButtonText}>Ask Question</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.commonQuestions, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Common Questions:</Text>
        {[
          'When will my lab results be ready?',
          'What should I know about my diagnosis?',
          'What are normal pregnancy symptoms?',
          'When should I schedule my next appointment?',
        ].map((q) => (
          <Text key={q} style={[styles.commonQ, { color: colors.subtext }]}>• {q}</Text>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 20, paddingTop: 16 }]}>
        My Questions
      </Text>

      <FlatList
        data={questions}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.question, { color: colors.text }]}>Q: {item.question}</Text>
            {item.answer ? (
              <View style={[styles.answerSection, { backgroundColor: colors.background }]}>
                <Text style={[styles.answer, { color: colors.text }]}>A: {item.answer}</Text>
                <Text style={[styles.timestamp, { color: colors.subtext }]}>
                  Answered {item.answeredAt?.toLocaleDateString()}
                </Text>
              </View>
            ) : (
              <Text style={styles.pending}>⏳ Waiting for answer...</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.subtext }]}>
            No questions yet. Ask your first question above!
          </Text>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { fontSize: 14 },
  inputSection: { padding: 20, borderBottomWidth: 1 },
  input: { borderWidth: 2, borderRadius: 10, padding: 15, fontSize: 16, minHeight: 80, textAlignVertical: 'top', marginBottom: 15 },
  askButton: { padding: 15, borderRadius: 10, alignItems: 'center' },
  askButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  commonQuestions: { padding: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  commonQ: { fontSize: 14, marginBottom: 5, paddingLeft: 10 },
  questionCard: { padding: 15, marginBottom: 15, borderRadius: 10, borderWidth: 1 },
  question: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  answerSection: { padding: 10, borderRadius: 8 },
  answer: { fontSize: 15, marginBottom: 5 },
  timestamp: { fontSize: 12 },
  pending: { fontSize: 14, color: '#ff9800', fontStyle: 'italic' },
  empty: { fontSize: 16, textAlign: 'center', marginTop: 30 },
  // Guest wall
  guestWall: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon: { fontSize: 64, marginBottom: 20 },
  guestWallTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  guestWallText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  createAccountButton: { paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, width: '100%', alignItems: 'center' },
  createAccountButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
