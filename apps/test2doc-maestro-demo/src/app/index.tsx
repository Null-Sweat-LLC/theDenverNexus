import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Todo = { id: number; title: string; done: boolean };

export default function HomeScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState('');

  const addTodo = () => {
    const title = draft.trim();
    if (!title) return;
    setTodos((current) => [...current, { id: Date.now(), title, done: false }]);
    setDraft('');
  };

  const toggleTodo = (id: number) =>
    setTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)),
    );

  const deleteTodo = (id: number) =>
    setTodos((current) => current.filter((todo) => todo.id !== id));

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.heading}>Todo</Text>
      <View style={styles.row}>
        <TextInput
          testID="todo-input"
          style={styles.input}
          placeholder="What needs doing?"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addTodo}
          returnKeyType="done"
        />
        <Pressable accessibilityRole="button" onPress={addTodo} style={styles.button}>
          <Text>Add</Text>
        </Pressable>
      </View>
      {todos.map((todo) => (
        <View key={todo.id} style={styles.row}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: todo.done }}
            onPress={() => toggleTodo(todo.id)}
            style={styles.itemPress}
          >
            <Text style={styles.item}>
              {todo.done ? '☑' : '☐'} {todo.title}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${todo.title}`}
            onPress={() => deleteTodo(todo.id)}
            style={styles.button}
          >
            <Text>Delete</Text>
          </Pressable>
        </View>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  heading: { fontSize: 28, fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#999', borderRadius: 6, padding: 8 },
  button: { justifyContent: 'center', paddingHorizontal: 12 },
  itemPress: { flex: 1 },
  item: { fontSize: 18, paddingVertical: 8 },
});
