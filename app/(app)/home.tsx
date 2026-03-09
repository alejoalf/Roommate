import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator
} from 'react-native'
import { supabase } from '../../lib/supabase'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [hasHome, setHasHome] = useState(false)
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu')
  const [homeName, setHomeName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    checkUserHome()
  }, [])

  async function checkUserHome() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('home_members')
      .select('home_id')
      .eq('user_id', user.id)
      .limit(1)

    if (data && data.length > 0) {
      setHasHome(true)
    }
    setLoading(false)
  }

  async function handleCreateHome() {
    if (!homeName.trim()) return Alert.alert('Escribí un nombre para el hogar')
    setSubmitting(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('Usuario:', user?.id)
    console.log('User error:', userError)

    if (!user) {
      Alert.alert('Error', 'No hay usuario logueado')
      setSubmitting(false)
      return
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    const { data: home, error: homeError } = await supabase
      .from('homes')
      .insert({ name: homeName.trim(), invite_code: code, created_by: user.id })
      .select()
      .single()

    console.log('Home creado:', home)
    console.log('Home error:', JSON.stringify(homeError))

    if (homeError) {
      Alert.alert('Error al crear hogar', homeError.message + ' - ' + homeError.code)
      setSubmitting(false)
      return
    }

    const { error: memberError } = await supabase
      .from('home_members')
      .insert({ home_id: home.id, user_id: user.id, role: 'admin' })

    console.log('Member error:', JSON.stringify(memberError))

    if (memberError) {
      Alert.alert('Error al unirse', memberError.message)
    } else {
      setHasHome(true)
    }

    setSubmitting(false)
  }

  async function handleJoinHome() {
    if (!inviteCode.trim()) return Alert.alert('Ingresá el código de invitación')
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Buscar el hogar con ese código
    const { data: home, error: homeError } = await supabase
      .from('homes')
      .select()
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single()

    if (homeError || !home) {
      Alert.alert('Error', 'Código inválido. Verificá que esté bien escrito.')
      setSubmitting(false)
      return
    }

    // Verificar que no sea ya miembro
    const { data: existing } = await supabase
      .from('home_members')
      .select()
      .eq('home_id', home.id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      Alert.alert('Ya sos miembro de este hogar')
      setSubmitting(false)
      return
    }

    // Unirse al hogar
    const { error: joinError } = await supabase
      .from('home_members')
      .insert({ home_id: home.id, user_id: user.id, role: 'member' })

    if (joinError) {
      Alert.alert('Error', joinError.message)
    } else {
      Alert.alert('✅ Te uniste a ' + home.name)
      setHasHome(true)
    }

    setSubmitting(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7fff6e" />
      </View>
    )
  }

  // Si ya tiene hogar — pantalla temporal hasta que hagamos el dashboard
  if (hasHome) {
    return (
      <View style={styles.center}>
        <Text style={styles.bigEmoji}>🏠</Text>
        <Text style={styles.title}>¡Estás en tu hogar!</Text>
        <Text style={styles.subtitle}>El dashboard viene en el próximo paso</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // MENÚ — crear o unirse
  if (mode === 'menu') {
    return (
      <View style={styles.container}>
        <Text style={styles.bigEmoji}>🏠</Text>
        <Text style={styles.title}>Bienvenido a{'\n'}RoomMate</Text>
        <Text style={styles.subtitle}>¿Qué querés hacer?</Text>

        <TouchableOpacity style={styles.btn} onPress={() => setMode('create')}>
          <Text style={styles.btnText}>✨ Crear un hogar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnOutline} onPress={() => setMode('join')}>
          <Text style={styles.btnOutlineText}>🔑 Unirme con código</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.link} onPress={handleLogout}>
          <Text style={styles.linkText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // CREAR HOGAR
  if (mode === 'create') {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setMode('menu')} style={styles.back}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.bigEmoji}>✨</Text>
        <Text style={styles.title}>Crear hogar</Text>
        <Text style={styles.subtitle}>Dale un nombre a tu hogar</Text>

        <TextInput
          style={styles.input}
          placeholder="Ej: Depto de los pibes"
          placeholderTextColor="#555"
          value={homeName}
          onChangeText={setHomeName}
        />

        <TouchableOpacity
          style={[styles.btn, submitting && styles.btnDisabled]}
          onPress={handleCreateHome}
          disabled={submitting}
        >
          <Text style={styles.btnText}>
            {submitting ? 'Creando...' : 'Crear hogar'}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  // UNIRSE CON CÓDIGO
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setMode('menu')} style={styles.back}>
        <Text style={styles.backText}>← Volver</Text>
      </TouchableOpacity>

      <Text style={styles.bigEmoji}>🔑</Text>
      <Text style={styles.title}>Unirme a un hogar</Text>
      <Text style={styles.subtitle}>Pedile el código a tu roommate</Text>

      <TextInput
        style={[styles.input, { letterSpacing: 4, textAlign: 'center', fontSize: 20 }]}
        placeholder="ABC123"
        placeholderTextColor="#555"
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="characters"
        maxLength={6}
      />

      <TouchableOpacity
        style={[styles.btn, submitting && styles.btnDisabled]}
        onPress={handleJoinHome}
        disabled={submitting}
      >
        <Text style={styles.btnText}>
          {submitting ? 'Uniéndome...' : 'Unirme'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0f0f14',
    justifyContent: 'center', paddingHorizontal: 32
  },
  center: {
    flex: 1, backgroundColor: '#0f0f14',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32
  },
  bigEmoji: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  title: {
    fontSize: 32, fontWeight: '900', color: '#f0f0f5',
    textAlign: 'center', letterSpacing: -1, marginBottom: 8
  },
  subtitle: {
    fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 40
  },
  input: {
    backgroundColor: '#18181f', color: '#f0f0f5',
    borderWidth: 1, borderColor: '#2a2a35',
    borderRadius: 8, padding: 16,
    fontSize: 15, marginBottom: 14
  },
  btn: {
    backgroundColor: '#7fff6e', borderRadius: 8,
    padding: 16, alignItems: 'center', marginBottom: 12
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#0f0f14', fontWeight: '800', fontSize: 15 },
  btnOutline: {
    borderWidth: 1, borderColor: '#2a2a35',
    borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 12
  },
  btnOutlineText: { color: '#f0f0f5', fontWeight: '700', fontSize: 15 },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#444', fontSize: 13 },
  back: { position: 'absolute', top: 60, left: 32 },
  backText: { color: '#666', fontSize: 14 },
  logoutBtn: { marginTop: 32 },
  logoutText: { color: '#444', fontSize: 13 }
})