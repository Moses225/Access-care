import { addDoc, collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');

  useEffect(() => {
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
  }, []);

  const askQuestion = async () => {
    if (!newQuestion.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    await addDoc(collection(db, 'questions'), {
      userId: uid,
      question: newQuestion,
      createdAt: new Date(),
    });

    setNewQuestion('');
    Alert.alert('Submitted', 'Your question has been submitted. A healthcare professional will answer soon.');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Ask Questions</Text>
        <Text style={styles.subtitle}>Get answers from healthcare professionals</Text>
      </View>

      <View style={styles.inputSection}>
        <TextInput
          style={styles.input}
          placeholder="What would you like to know?"
          placeholderTextColor="#888"
          value={newQuestion}
          onChangeText={setNewQuestion}
          multiline
        />
        <TouchableOpacity style={styles.askButton} onPress={askQuestion}>
          <Text style={styles.askButtonText}>Ask Question</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.commonQuestions}>
        <Text style={styles.sectionTitle}>Common Questions:</Text>
        <Text style={styles.commonQ}>• When will my lab results be ready?</Text>
        <Text style={styles.commonQ}>• What should I know about my diagnosis?</Text>
        <Text style={styles.commonQ}>• What are normal pregnancy symptoms?</Text>
        <Text style={styles.commonQ}>• When should I schedule my next appointment?</Text>
      </View>

      <Text style={styles.sectionTitle}>My Questions</Text>
      
      <FlatList
        data={questions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.questionCard}>
            <Text style={styles.question}>Q: {item.question}</Text>
            {item.answer ? (
              <View style={styles.answerSection}>
                <Text style={styles.answer}>A: {item.answer}</Text>
                <Text style={styles.timestamp}>
                  Answered {item.answeredAt?.toLocaleDateString()}
                </Text>
              </View>
            ) : (
              <Text style={styles.pending}>⏳ Waiting for answer...</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No questions yet. Ask your first question above!</Text>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#f0f0ff' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#666' },
  inputSection: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  input: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 15,
    color: '#333',
    backgroundColor: '#fff',
  },
  askButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  askButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  commonQuestions: {
    padding: 20,
    backgroundColor: '#fff9e6',
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', paddingHorizontal: 20, marginBottom: 10 },
  commonQ: { fontSize: 14, color: '#666', marginBottom: 5, paddingLeft: 10 },
  questionCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  question: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 10 },
  answerSection: { backgroundColor: '#f0f0ff', padding: 10, borderRadius: 8 },
  answer: { fontSize: 15, color: '#333', marginBottom: 5 },
  timestamp: { fontSize: 12, color: '#999' },
  pending: { fontSize: 14, color: '#ff9800', fontStyle: 'italic' },
  empty: { fontSize: 16, color: '#999', textAlign: 'center', marginTop: 30, paddingHorizontal: 40 },
});