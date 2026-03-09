import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Platform
} from 'react-native'
import { useRouter } from 'expo-router'
import { clearPersistedAuthSession, supabase } from '../../lib/supabase'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hasHome, setHasHome] = useState(false)
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu')
  const [homeName, setHomeName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { checkUserHome() }, [])

  async function checkUserHome() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('home_members').select('home_id').eq('user_id', user.id).limit(1)
    if (data && data.length > 0) setHasHome(true)
    setLoading(false)
  }

  async function handleCreateHome() {
    if (!homeName.trim()) return Alert.alert('Escribí un nombre para el hogar')
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data: home, error: homeError } = await supabase
      .from('homes').insert({ name: homeName.trim(), invite_code: code, created_by: user.id })
      .select().single()
    if (homeError) { Alert.alert('Error', homeError.message); setSubmitting(false); return }
    const { error: memberError } = await supabase
      .from('home_members').insert({ home_id: home.id, user_id: user.id, role: 'admin' })
    if (memberError) Alert.alert('Error', memberError.message)
    else setHasHome(true)
    setSubmitting(false)
  }

  async function handleJoinHome() {
    if (!inviteCode.trim()) return Alert.alert('Ingresá el código de invitación')
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: home, error } = await supabase
      .from('homes').select().eq('invite_code', inviteCode.trim().toUpperCase()).single()
    if (error || !home) { Alert.alert('Código inválido'); setSubmitting(false); return }
    const { data: existing } = await supabase
      .from('home_members').select().eq('home_id', home.id).eq('user_id', user.id).maybeSingle()
    if (existing) { Alert.alert('Ya sos miembro de este hogar'); setSubmitting(false); return }
    const { error: joinError } = await supabase
      .from('home_members').insert({ home_id: home.id, user_id: user.id, role: 'member' })
    if (joinError) Alert.alert('Error', joinError.message)
    else { Alert.alert('✅ ¡Bienvenido!', `Te uniste a "${home.name}"`); setHasHome(true) }
    setSubmitting(false)
  }

  async function handleSignOut() {
    // Usar signOut simple - el evento SIGNED_OUT en _layout va a redirigir
    await supabase.auth.signOut()
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator color="#e67e50" size="large" /></View>
  )

  if (hasHome) return (
    <View style={s.center}>
      <Text style={{ fontSize: 52, marginBottom: 16 }}>🏠</Text>
      <Text style={s.title}>¡Estás en tu hogar!</Text>
      <Text style={s.sub}>Cargando dashboard...</Text>
    </View>
  )

  if (mode === 'menu') return (
    <View style={s.container}>
      <View style={s.logoWrap}>
        <Text style={{ fontSize: 52, marginBottom: 12 }}>🏠</Text>
        <Text style={s.title}>Configurá tu Hogar</Text>
        <Text style={s.sub}>Creá uno nuevo o unite a uno existente</Text>
      </View>

      <View style={s.grid}>
        <TouchableOpacity style={s.optionCard} onPress={() => setMode('create')} activeOpacity={0.8}>
          <View style={[s.optionIcon, { backgroundColor: 'rgba(230,126,80,0.12)', borderColor: 'rgba(230,126,80,0.25)' }]}>
            <Text style={{ fontSize: 32 }}>✨</Text>
          </View>
          <Text style={s.optionTitle}>Crear Hogar</Text>
          <Text style={s.optionDesc}>Iniciá uno nuevo e invitá a tus roommates</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.optionCard} onPress={() => setMode('join')} activeOpacity={0.8}>
          <View style={[s.optionIcon, { backgroundColor: 'rgba(212,165,116,0.12)', borderColor: 'rgba(212,165,116,0.25)' }]}>
            <Text style={{ fontSize: 32 }}>🔑</Text>
          </View>
          <Text style={s.optionTitle}>Unirme</Text>
          <Text style={s.optionDesc}>Usá el código que te compartió tu roommate</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.logoutLink} onPress={handleSignOut}>
        <Text style={s.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  )

  if (mode === 'create') return (
    <View style={s.container}>
      <TouchableOpacity style={s.back} onPress={() => setMode('menu')}>
        <Text style={s.backText}>← Volver</Text>
      </TouchableOpacity>

      <View style={s.formCard}>
        <View style={[s.optionIcon, { backgroundColor: 'rgba(230,126,80,0.12)', borderColor: 'rgba(230,126,80,0.25)', marginBottom: 16 }]}>
          <Text style={{ fontSize: 32 }}>🏠</Text>
        </View>
        <Text style={s.title}>Crear Nuevo Hogar</Text>
        <Text style={s.sub}>Dale un nombre a tu hogar</Text>

        <View style={s.inputWrap}>
          <Text style={s.inputLabel}>Nombre del Hogar</Text>
          <TextInput
            style={s.input}
            placeholder='Ej: "Casa de la Playa" 🏖️'
            placeholderTextColor="#5a4a40"
            value={homeName}
            onChangeText={setHomeName}
          />
        </View>

        <View style={s.tip}>
          <Text style={s.tipText}>
            💡 Después de crear el hogar recibirás un código para compartir con tus roommates
          </Text>
        </View>

        <TouchableOpacity
          style={[s.btn, submitting && s.btnDisabled]}
          onPress={handleCreateHome} disabled={submitting}
        >
          <Text style={s.btnText}>{submitting ? 'Creando...' : 'Crear Hogar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={s.container}>
      <TouchableOpacity style={s.back} onPress={() => setMode('menu')}>
        <Text style={s.backText}>← Volver</Text>
      </TouchableOpacity>

      <View style={s.formCard}>
        <View style={[s.optionIcon, { backgroundColor: 'rgba(212,165,116,0.12)', borderColor: 'rgba(212,165,116,0.25)', marginBottom: 16 }]}>
          <Text style={{ fontSize: 32 }}>🔑</Text>
        </View>
        <Text style={s.title}>Unirse a un Hogar</Text>
        <Text style={s.sub}>Ingresá el código de 6 caracteres</Text>

        <View style={s.inputWrap}>
          <Text style={s.inputLabel}>Código del Hogar</Text>
          <TextInput
            style={[s.input, { textAlign: 'center', letterSpacing: 6, fontSize: 22, fontWeight: '800' }]}
            placeholder="ABC123"
            placeholderTextColor="#5a4a40"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            maxLength={6}
          />
        </View>

        <View style={s.tip}>
          <Text style={s.tipText}>
            💡 El código te lo tiene que dar quien creó el hogar
          </Text>
        </View>

        <TouchableOpacity
          style={[s.btn, { backgroundColor: '#d4a574' }, submitting && s.btnDisabled]}
          onPress={handleJoinHome} disabled={submitting}
        >
          <Text style={[s.btnText, { color: '#110e0a' }]}>
            {submitting ? 'Uniéndome...' : 'Unirme al Hogar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#110e0a', justifyContent: 'center', paddingHorizontal: 24 },
  center: { flex: 1, backgroundColor: '#110e0a', justifyContent: 'center', alignItems: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 28, fontWeight: '700', color: '#f5ede4',
    textAlign: 'center', letterSpacing: -0.3, marginBottom: 8
  },
  sub: { fontSize: 13, color: '#8a7060', textAlign: 'center', lineHeight: 20 },
  grid: { gap: 12, marginBottom: 28 },
  optionCard: {
    backgroundColor: '#1c1712', borderRadius: 16,
    padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)'
  },
  optionIcon: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1, justifyContent: 'center',
    alignItems: 'center', marginBottom: 12
  },
  optionTitle: { fontSize: 17, fontWeight: '800', color: '#f5ede4', marginBottom: 4 },
  optionDesc: { fontSize: 12, color: '#8a7060', textAlign: 'center' },
  logoutLink: { alignItems: 'center' },
  logoutText: { fontSize: 13, color: '#5a4a40' },
  back: { position: 'absolute', top: 60, left: 24 },
  backText: { fontSize: 14, color: '#8a7060' },
  formCard: {
    backgroundColor: '#1c1712', borderRadius: 20,
    padding: 28, borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.15)', alignItems: 'center'
  },
  inputWrap: { width: '100%', gap: 6, marginTop: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#d4a574' },
  input: {
    backgroundColor: '#242018', color: '#f5ede4',
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.2)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, width: '100%'
  },
  tip: {
    backgroundColor: 'rgba(212,165,116,0.06)',
    borderRadius: 10, padding: 12, marginTop: 14,
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.12)', width: '100%'
  },
  tipText: { fontSize: 12, color: '#8a7060', lineHeight: 18 },
  btn: {
    backgroundColor: '#e67e50', borderRadius: 10,
    paddingVertical: 15, alignItems: 'center',
    marginTop: 16, width: '100%'
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
})