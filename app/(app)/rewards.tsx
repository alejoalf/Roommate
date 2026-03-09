import { View, Text, StyleSheet } from 'react-native'
export default function Rewards() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎁</Text>
      <Text style={styles.title}>Premios</Text>
      <Text style={styles.sub}>Próximamente</Text>
    </View>
  )
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f14', justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '900', color: '#f0f0f5' },
  sub: { fontSize: 14, color: '#444', marginTop: 8 }
})