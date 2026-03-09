import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, Linking
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

const APK_DOWNLOAD_URL = process.env.EXPO_PUBLIC_APK_URL?.trim() || ''

export default function Login() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')

  // Login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Register
  const [regName, setRegName] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regLoading, setRegLoading] = useState(false)

  async function handleLogin() {
    if (!loginEmail || !loginPassword) return Alert.alert('Completá todos los campos')
    setLoginLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail, password: loginPassword
    })
    if (error) Alert.alert('Error', error.message)
    setLoginLoading(false)
  }

  async function handleRegister() {
    if (!regName || !regUsername || !regEmail || !regPassword)
      return Alert.alert('Completá todos los campos')
    if (regPassword.length < 6)
      return Alert.alert('La contraseña debe tener al menos 6 caracteres')
    setRegLoading(true)
    const { error } = await supabase.auth.signUp({
      email: regEmail, password: regPassword,
      options: { data: { full_name: regName, username: regUsername.toLowerCase() } }
    })
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles')
          .update({ username: regUsername.toLowerCase(), full_name: regName })
          .eq('id', user.id)
      }
    }
    setRegLoading(false)
  }

  async function handleApkDownload() {
    if (!APK_DOWNLOAD_URL) {
      Alert.alert('Falta configurar el enlace del APK')
      return
    }
    const canOpen = await Linking.canOpenURL(APK_DOWNLOAD_URL)
    if (!canOpen) {
      Alert.alert('No se pudo abrir el enlace del APK')
      return
    }
    await Linking.openURL(APK_DOWNLOAD_URL)
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">

        {/* LOGO */}
        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Text style={s.logoEmoji}>🏠</Text>
          </View>
          <Text style={s.appName}>RoomMate</Text>
          <Text style={s.appSub}>Organizá tu hogar con tus compañeros</Text>
        </View>

        {/* CARD */}
        <View style={s.card}>

          {/* TABS */}
          <View style={s.tabs}>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'login' && s.tabBtnActive]}
              onPress={() => setTab('login')}
            >
              <Text style={[s.tabText, tab === 'login' && s.tabTextActive]}>
                Iniciar Sesión
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'register' && s.tabBtnActive]}
              onPress={() => setTab('register')}
            >
              <Text style={[s.tabText, tab === 'register' && s.tabTextActive]}>
                Registro
              </Text>
            </TouchableOpacity>
          </View>

          {/* LOGIN */}
          {tab === 'login' && (
            <View style={s.form}>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Email</Text>
                <TextInput
                  style={s.input}
                  placeholder="tu@email.com"
                  placeholderTextColor="#5a4a40"
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Contraseña</Text>
                <TextInput
                  style={s.input}
                  placeholder="••••••••"
                  placeholderTextColor="#5a4a40"
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  secureTextEntry
                />
              </View>
              <TouchableOpacity
                style={[s.btn, loginLoading && s.btnDisabled]}
                onPress={handleLogin}
                disabled={loginLoading}
              >
                <Text style={s.btnText}>
                  {loginLoading ? 'Entrando...' : 'Iniciar Sesión'}
                </Text>
              </TouchableOpacity>

              <View style={s.apkBox}>
                <Text style={s.apkTitle}>Preferis instalar la app Android?</Text>
                <Text style={s.apkHint}>Descarga directa del APK</Text>
                <TouchableOpacity
                  style={[s.apkBtn, !APK_DOWNLOAD_URL && s.apkBtnDisabled]}
                  onPress={handleApkDownload}
                  disabled={!APK_DOWNLOAD_URL}
                >
                  <Text style={s.apkBtnText}>
                    {APK_DOWNLOAD_URL ? 'Descargar APK' : 'APK no disponible'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* REGISTER */}
          {tab === 'register' && (
            <View style={s.form}>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Nombre completo</Text>
                <TextInput
                  style={s.input}
                  placeholder="Tu nombre"
                  placeholderTextColor="#5a4a40"
                  value={regName}
                  onChangeText={setRegName}
                />
              </View>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Nombre de usuario</Text>
                <TextInput
                  style={s.input}
                  placeholder="@usuario"
                  placeholderTextColor="#5a4a40"
                  value={regUsername}
                  onChangeText={t => setRegUsername(t.toLowerCase().replace(/\s/g, ''))}
                  autoCapitalize="none"
                />
              </View>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Email</Text>
                <TextInput
                  style={s.input}
                  placeholder="tu@email.com"
                  placeholderTextColor="#5a4a40"
                  value={regEmail}
                  onChangeText={setRegEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Contraseña</Text>
                <TextInput
                  style={s.input}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#5a4a40"
                  value={regPassword}
                  onChangeText={setRegPassword}
                  secureTextEntry
                />
              </View>
              <TouchableOpacity
                style={[s.btn, regLoading && s.btnDisabled]}
                onPress={handleRegister}
                disabled={regLoading}
              >
                <Text style={s.btnText}>
                  {regLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </View>

        <Text style={s.footer}>
          Al continuar, aceptás nuestros términos y condiciones
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#110e0a' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 48 },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(230,126,80,0.12)',
    borderWidth: 1, borderColor: 'rgba(230,126,80,0.25)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14
  },
  logoEmoji: { fontSize: 32 },
  appName: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 34, fontWeight: '700',
    color: '#f5ede4', letterSpacing: -0.5, marginBottom: 6
  },
  appSub: { fontSize: 13, color: '#8a7060', textAlign: 'center' },
  card: {
    backgroundColor: '#1c1712',
    borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)'
  },
  tabs: {
    flexDirection: 'row', gap: 6,
    backgroundColor: '#242018', borderRadius: 10,
    padding: 4, marginBottom: 24
  },
  tabBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 8,
    alignItems: 'center'
  },
  tabBtnActive: { backgroundColor: '#e67e50' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#8a7060' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  form: { gap: 14 },
  inputWrap: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#d4a574' },
  input: {
    backgroundColor: '#242018', color: '#f5ede4',
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.2)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14
  },
  btn: {
    backgroundColor: '#e67e50', borderRadius: 10,
    paddingVertical: 15, alignItems: 'center', marginTop: 6
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  apkBox: {
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.2)',
    backgroundColor: '#201a14'
  },
  apkTitle: { color: '#f5ede4', fontSize: 13, fontWeight: '700' },
  apkHint: { color: '#b89a84', fontSize: 12, marginTop: 4, marginBottom: 10 },
  apkBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#2d241b',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  apkBtnDisabled: { opacity: 0.5 },
  apkBtnText: { color: '#f5ede4', fontSize: 12, fontWeight: '700' },
  footer: {
    textAlign: 'center', fontSize: 11,
    color: '#5a4a40', marginTop: 20
  }
})