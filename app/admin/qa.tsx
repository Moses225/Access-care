import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { db, auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

type Question = {
  id: string;
  userId: string;
  question: string;
  answer?: string;
  createdAt: Date;
  answeredAt?: Date;
};

export default function AdminQAScreen() {
  const { user, initializing } = useAuth();
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingClaim, setCheckingClaim] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answerText, setAnswerText] = useState<{ [key: string]: string }>({});

  // ─── Check admin custom claim ─────────────────────────────────────────────
  useEffect(() => {
    const checkAdminClaim = async () => {
      if (initializing) return;

      if (!user) {
        setCheckingClaim(false);
        return;
      }

      try {
        // Force refresh to get latest claims
        const tokenResult = await user.getIdTokenResult(true);
        const adminClaim = tokenResult.claims.admin === true;
        setIsAdmin(adminClaim);

        if (__DEV__) {
          console.log('🔐 Admin claim check:', adminClaim ? 'GRANTED' : 'DENIED');
        }
      } catch (error) {
        if (__DEV__) console.error('Error checking admin claim:', error);
        setIsAdmin(false);
      } finally {
        setCheckingClaim(false);
      }
    };

    checkAdminClaim();
  }, [user, initializing]);

  // ─── Load questions only if admin ─────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;

    const q = query(
      collection(db, 'questions'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
        answeredAt: docSnap.data().answeredAt?.toDate(),
      })) as Question[];
      setQuestions(data);
    });

    return unsubscribe;
  }, [isAdmin]);

  const answerQuestion = async (questionId: string) => {
    const answer = answerText[questionId];
    if (!answer?.trim()) {
      Alert.alert('Error', 'Please enter an answer');
      return;
    }

    try {
      await updateDoc(doc(db, 'questions', questionId), {
        answer: answer.trim(),
        answeredAt: new Date(),
      });
      setAnswerText(prev => ({ ...prev, [questionId]: '' }));
      Alert.alert('Success', 'Answer submitted!');
    } catch {
      Alert.alert('Error', 'Failed to submit answer');
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (initializing || checkingClaim) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2E75B6" />
        <Text style={styles.loadingText}>Verifying access...</Text>
      </View>
    );
  }

  // ─── Not logged in ────────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.deniedIcon}>🔒</Text>
        <Text style={styles.deniedTitle}>Authentication Required</Text>
        <Text style={styles.deniedText}>You must be logged in to access this page.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/welcome')}>
          <Text style={styles.backButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Not admin ────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.deniedIcon}>⛔</Text>
        <Text style={styles.deniedTitle}>Access Denied</Text>
        <Text style={styles.deniedText}>
          You do not have permission to access the admin panel.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Admin view ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Q&A Dashboard</Text>
      <Text style={styles.subtitle}>Answer patient questions</Text>

      <FlatList
        data={questions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.questionCard}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {item.answer ? '✅ Answered' : '⏳ Pending'}
              </Text>
            </View>

            <Text style={styles.question}>Q: {item.question}</Text>
            <Text style={styles.timestamp}>
              Asked {item.createdAt?.toLocaleDateString()}
            </Text>

            {item.answer ? (
              <View style={styles.existingAnswer}>
                <Text style={styles.answerLabel}>Your Answer:</Text>
                <Text style={styles.answer}>{item.answer}</Text>
              </View>
            ) : (
              <View style={styles.answerSection}>
                <TextInput
                  style={styles.input}
                  placeholder="Type your answer..."
                  placeholderTextColor="#888"
                  value={answerText[item.id] || ''}
                  onChangeText={(text) =>
                    setAnswerText(prev => ({ ...prev, [item.id]: text }))
                  }
                  multiline
                  accessibilityLabel="Answer input"
                />
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={() => answerQuestion(item.id)}
                  accessibilityLabel="Submit answer"
                  accessibilityRole="button"
                >
                  <Text style={styles.submitButtonText}>Submit Answer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No questions yet.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  centerContainer: {
    flex: 1, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  deniedIcon: { fontSize: 64, marginBottom: 16 },
  deniedTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  deniedText: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 24 },
  backButton: {
    backgroundColor: '#2E75B6', paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 8,
  },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  questionCard: {
    backgroundColor: '#fff', padding: 15, marginBottom: 15,
    borderRadius: 10, borderWidth: 2, borderColor: '#e0e0e0',
  },
  statusBadge: {
    alignSelf: 'flex-start', backgroundColor: '#f0f0f0',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, marginBottom: 10,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  question: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 5 },
  timestamp: { fontSize: 12, color: '#999', marginBottom: 15 },
  existingAnswer: { backgroundColor: '#e8f5e9', padding: 10, borderRadius: 8 },
  answerLabel: { fontSize: 12, color: '#666', marginBottom: 5 },
  answer: { fontSize: 15, color: '#333' },
  answerSection: { marginTop: 10 },
  input: {
    borderWidth: 2, borderColor: '#e0e0e0', borderRadius: 10,
    padding: 15, fontSize: 16, minHeight: 80,
    textAlignVertical: 'top', marginBottom: 10, color: '#333',
  },
  submitButton: {
    backgroundColor: '#4caf50', padding: 12,
    borderRadius: 8, alignItems: 'center',
  },
  submitButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  empty: { fontSize: 16, color: '#999', textAlign: 'center', marginTop: 50 },
});
