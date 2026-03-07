import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email || !password) return Alert.alert('Completá todos los campos')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) Alert.alert('Error', error.message)
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>

        <Text style={styles.logo}>🏠</Text>
        <Text style={styles.title}>RoomMate</Text>
        <Text style={styles.subtitle}>Iniciá sesión en tu hogar</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.linkText}>
            ¿No tenés cuenta? <Text style={styles.linkAccent}>Registrate</Text>
          </Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f14' },
  inner: {
    flex: 1, justifyContent: 'center',
    paddingHorizontal: 32, paddingBottom: 40
  },
  logo: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  title: {
    fontSize: 36, fontWeight: '900', color: '#f0f0f5',
    textAlign: 'center', letterSpacing: -1, marginBottom: 6
  },
  subtitle: {
    fontSize: 14, color: '#666', textAlign: 'center',
    marginBottom: 40, letterSpacing: 0.3
  },
  input: {
    backgroundColor: '#18181f', color: '#f0f0f5',
    borderWidth: 1, borderColor: '#2a2a35',
    borderRadius: 8, padding: 16,
    fontSize: 15, marginBottom: 14
  },
  btn: {
    backgroundColor: '#7fff6e', borderRadius: 8,
    padding: 16, alignItems: 'center', marginTop: 8
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#0f0f14', fontWeight: '800', fontSize: 15 },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#555', fontSize: 13 },
  linkAccent: { color: '#7fff6e', fontWeight: '700' }
})