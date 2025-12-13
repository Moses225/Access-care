import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase';

type Question = {
  id: string;
  userId: string;
  question: string;
  answer?: string;
  createdAt: Date;
  answeredAt?: Date;
};

export default function AdminQAScreen() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answerText, setAnswerText] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const q = query(
      collection(db, 'questions'),
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

  const answerQuestion = async (questionId: string) => {
    const answer = answerText[questionId];
    if (!answer?.trim()) {
      Alert.alert('Error', 'Please enter an answer');
      return;
    }

    try {
      await updateDoc(doc(db, 'questions', questionId), {
        answer: answer,
        answeredAt: new Date(),
      });

      setAnswerText(prev => ({ ...prev, [questionId]: '' }));
      Alert.alert('Success', 'Answer submitted!');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit answer');
    }
  };

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
                  onChangeText={(text) => setAnswerText(prev => ({ ...prev, [item.id]: text }))}
                  multiline
                />
                <TouchableOpacity 
                  style={styles.submitButton}
                  onPress={() => answerQuestion(item.id)}
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
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  questionCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  question: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 5 },
  timestamp: { fontSize: 12, color: '#999', marginBottom: 15 },
  existingAnswer: {
    backgroundColor: '#e8f5e9',
    padding: 10,
    borderRadius: 8,
  },
  answerLabel: { fontSize: 12, color: '#666', marginBottom: 5 },
  answer: { fontSize: 15, color: '#333' },
  answerSection: { marginTop: 10 },
  input: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#4caf50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  empty: { fontSize: 16, color: '#999', textAlign: 'center', marginTop: 50 },
});