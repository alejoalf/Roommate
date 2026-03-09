import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl
} from 'react-native'
import { supabase } from '../../lib/supabase'

type Member = {
  user_id: string
  points: number
  profile: {
    full_name: string
    username: string
    total_points: number
    level: number
  }
}

const LEVEL_NAMES = ['Novato', 'Aprendiz', 'Habitante', 'Pro', 'Experto', 'Leyenda']
const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 1000]

function getLevel(points: number) {
  let level = 0
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) { level = i; break }
  }
  return { level, name: LEVEL_NAMES[level], next: LEVEL_THRESHOLDS[level + 1] || null }
}

function getMedal(index: number) {
  if (index === 0) return '🥇'
  if (index === 1) return '🥈'
  if (index === 2) return '🥉'
  return `#${index + 1}`
}

export default function RankingScreen() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState('')
  const [homeName, setHomeName] = useState('')
  const [myPoints, setMyPoints] = useState(0)

  useEffect(() => { loadRanking() }, [])

  async function loadRanking() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: membership } = await supabase
      .from('home_members')
      .select('home_id, homes(name)')
      .eq('user_id', user.id)
      .single()

    if (!membership) { setLoading(false); return }

    const homeData = membership.homes as any
    setHomeName(homeData.name)

    const { data } = await supabase
      .from('home_members')
      .select('user_id, points, profile:profiles(full_name, username, total_points, level)')
      .eq('home_id', membership.home_id)
      .order('points', { ascending: false })

    const list = (data as any) || []
    setMembers(list)

    const mine = list.find((m: Member) => m.user_id === user.id)
    if (mine) setMyPoints(mine.points)

    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadRanking()
    setRefreshing(false)
  }, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7fff6e" size="large" />
      </View>
    )
  }

  const myLevel = getLevel(myPoints)
  const myRank = members.findIndex(m => m.user_id === userId)

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>RANKING</Text>
        <Text style={styles.headerTitle}>{homeName}</Text>
      </View>

      {/* MI ESTADO */}
      <View style={styles.myCard}>
        <View style={styles.myCardLeft}>
          <Text style={styles.myRank}>{getMedal(myRank)}</Text>
          <View>
            <Text style={styles.myLabel}>TU POSICIÓN</Text>
            <Text style={styles.myPoints}>{myPoints} pts</Text>
            <Text style={styles.myLevel}>⚡ {myLevel.name}</Text>
          </View>
        </View>
        {myLevel.next && (
          <View style={styles.myCardRight}>
            <Text style={styles.nextLabel}>PRÓXIMO NIVEL</Text>
            <Text style={styles.nextValue}>{myLevel.next - myPoints} pts</Text>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, ((myPoints - LEVEL_THRESHOLDS[myLevel.level]) /
                    (myLevel.next - LEVEL_THRESHOLDS[myLevel.level])) * 100)}%`
                }
              ]} />
            </View>
          </View>
        )}
      </View>

      {/* LISTA RANKING */}
      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7fff6e" />}
      >
        <Text style={styles.sectionLabel}>ESTE MES</Text>

        {members.map((member, index) => {
          const isMe = member.user_id === userId
          const lvl = getLevel(member.points)

          return (
            <View key={member.user_id} style={[styles.row, isMe && styles.rowMe]}>

              <Text style={styles.rowMedal}>{getMedal(index)}</Text>

              <View style={styles.rowAvatar}>
                <Text style={{ fontSize: 18 }}>
                  {(member.profile?.full_name || member.profile?.username || '?')[0].toUpperCase()}
                </Text>
              </View>

              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, isMe && styles.rowNameMe]}>
                  {member.profile?.full_name || member.profile?.username || 'Sin nombre'}
                  {isMe ? '  (vos)' : ''}
                </Text>
                <Text style={styles.rowLevel}>⚡ {lvl.name}</Text>
              </View>

              <View style={styles.rowRight}>
                <Text style={[styles.rowPoints, isMe && styles.rowPointsMe]}>
                  {member.points}
                </Text>
                <Text style={styles.rowPtsLabel}>pts</Text>
              </View>

            </View>
          )
        })}

        {/* NIVELES */}
        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>NIVELES</Text>
        <View style={styles.levelsGrid}>
          {LEVEL_NAMES.map((name, i) => (
            <View key={name} style={[
              styles.levelItem,
              myPoints >= LEVEL_THRESHOLDS[i] && styles.levelItemUnlocked
            ]}>
              <Text style={styles.levelPoints}>{LEVEL_THRESHOLDS[i]}+ pts</Text>
              <Text style={styles.levelName}>{name}</Text>
              {myPoints >= LEVEL_THRESHOLDS[i] && (
                <Text style={styles.levelCheck}>✓</Text>
              )}
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f14' },
  center: { flex: 1, backgroundColor: '#0f0f14', justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24,
    borderBottomWidth: 1, borderBottomColor: '#1a1a24'
  },
  headerLabel: { fontSize: 10, color: '#444', letterSpacing: 0.15, marginBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#f0f0f5', letterSpacing: -0.5 },
  myCard: {
    margin: 20, padding: 20,
    backgroundColor: '#18181f',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(127,255,110,0.2)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  myCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  myRank: { fontSize: 36 },
  myLabel: { fontSize: 9, color: '#444', letterSpacing: 0.12, marginBottom: 2 },
  myPoints: { fontSize: 24, fontWeight: '900', color: '#7fff6e', letterSpacing: -0.5 },
  myLevel: { fontSize: 12, color: '#555', marginTop: 2 },
  myCardRight: { alignItems: 'flex-end' },
  nextLabel: { fontSize: 9, color: '#444', letterSpacing: 0.1, marginBottom: 2 },
  nextValue: { fontSize: 16, fontWeight: '800', color: '#f0f0f5', marginBottom: 6 },
  progressBar: {
    width: 80, height: 4, backgroundColor: '#2a2a35',
    borderRadius: 2, overflow: 'hidden'
  },
  progressFill: { height: '100%', backgroundColor: '#7fff6e', borderRadius: 2 },
  list: { flex: 1, paddingHorizontal: 20 },
  sectionLabel: {
    fontSize: 10, color: '#444', letterSpacing: 0.15,
    marginBottom: 12, marginTop: 4
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#18181f', borderRadius: 10,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#2a2a35', gap: 12
  },
  rowMe: { borderColor: 'rgba(127,255,110,0.3)', backgroundColor: '#1a1f1a' },
  rowMedal: { fontSize: 20, width: 30, textAlign: 'center' },
  rowAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#2a2a35',
    justifyContent: 'center', alignItems: 'center'
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '700', color: '#f0f0f5' },
  rowNameMe: { color: '#7fff6e' },
  rowLevel: { fontSize: 11, color: '#555', marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowPoints: { fontSize: 18, fontWeight: '900', color: '#f0f0f5' },
  rowPointsMe: { color: '#7fff6e' },
  rowPtsLabel: { fontSize: 9, color: '#444', letterSpacing: 0.1 },
  levelsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8
  },
  levelItem: {
    width: '31%', padding: 12, borderRadius: 8,
    backgroundColor: '#18181f', borderWidth: 1,
    borderColor: '#2a2a35', position: 'relative'
  },
  levelItemUnlocked: { borderColor: 'rgba(127,255,110,0.3)' },
  levelPoints: { fontSize: 10, color: '#444', marginBottom: 4 },
  levelName: { fontSize: 13, fontWeight: '700', color: '#f0f0f5' },
  levelCheck: {
    position: 'absolute', top: 8, right: 10,
    fontSize: 12, color: '#7fff6e', fontWeight: '900'
  }
})