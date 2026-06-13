import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen({ navigation }: any) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function signIn() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Login failed', error.message);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <Text style={s.tree}>🌳</Text>
        <Text style={s.brand}>Trevor Heaps Arboricultural</Text>
        <Text style={s.title}>Surveyor Portal</Text>

        <TextInput
          style={s.input}
          placeholder="Email address"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={s.btn} onPress={signIn} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={s.registerLink}>Create an account</Text>
        </TouchableOpacity>

        <Text style={s.hint}>Already have an account? Use your login details above.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const GREEN = '#1a3c2e';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7f4', justifyContent: 'center', padding: 24 },
  card:      { backgroundColor: '#fff', borderRadius: 16, padding: 32, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  tree:      { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  brand:     { fontSize: 13, fontWeight: '600', color: GREEN, textAlign: 'center', marginBottom: 4, letterSpacing: 0.3 },
  title:     { fontSize: 22, fontWeight: '700', color: GREEN, textAlign: 'center', marginBottom: 28 },
  input:     { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 14, color: '#111' },
  btn:       { backgroundColor: GREEN, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  registerLink: { marginTop: 16, textAlign: 'center', fontSize: 14, color: GREEN, fontWeight: '600', textDecorationLine: 'underline' },
  hint:      { marginTop: 16, textAlign: 'center', fontSize: 12, color: '#9ca3af' },
});
