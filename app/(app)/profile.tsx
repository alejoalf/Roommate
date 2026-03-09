import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { supabase } from '../../lib/supabase'
export default function Profile() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👤</Text>
      <Text style={styles.title}>Perfil</Text>
      <TouchableOpacity style={styles.btn} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.btnText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  )
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f14', justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '900', color: '#f0f0f5', marginBottom: 32 },
  btn: { backgroundColor: '#18181f', borderWidth: 1, borderColor: '#2a2a35', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: '#ff6b6b', fontWeight: '700' }
})