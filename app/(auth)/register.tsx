import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function Register() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    if (!fullName || !username || !email || !password)
      return Alert.alert('Completá todos los campos')

    if (password.length < 6)
      return Alert.alert('La contraseña debe tener al menos 6 caracteres')

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username }
      }
    })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      // Guardar username en profiles
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ username, full_name: fullName })
          .eq('id', user.id)
      }
    }

    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner}>

        <Text style={styles.logo}>👋</Text>
        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>Unite a tu hogar</Text>

        <TextInput
          style={styles.input}
          placeholder="Nombre completo"
          placeholderTextColor="#555"
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput
          style={styles.input}
          placeholder="Nombre de usuario"
          placeholderTextColor="#555"
          value={username}
          onChangeText={text => setUsername(text.toLowerCase().replace(/\s/g, ''))}
          autoCapitalize="none"
        />

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
          placeholder="Contraseña (mínimo 6 caracteres)"
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          onPress={() => router.back()}
        >
          <Text style={styles.linkText}>
            ¿Ya tenés cuenta? <Text style={styles.linkAccent}>Iniciá sesión</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f14' },
  inner: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: 32, paddingVertical: 60
  },
  logo: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  title: {
    fontSize: 32, fontWeight: '900', color: '#f0f0f5',
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