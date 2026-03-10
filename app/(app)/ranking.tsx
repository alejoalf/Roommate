import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, Platform
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { SkeletonScreen, FadeInView, ScaleInView } from '../../components/Animated'

type Member = {
  user_id: string; points: number
  profile: { full_name: string; username: string; total_points: number }
}

const LEVELS = ['Novato', 'Aprendiz', 'Habitante', 'Pro', 'Experto', 'Leyenda']
const LEVEL_PTS = [0, 50, 150, 300, 500, 1000]
const LEVEL_EMO = ['🌱', '⚡', '🏠', '🔥', '💎', '👑']
const AVATAR_COLORS = ['#8b5a3c', '#d4a574', '#e67e50', '#a0705a', '#c9996b', '#6ba3c8', '#9b7ec8']

function getLevel(pts: number) {
  let i = 0
  for (let j = LEVEL_PTS.length - 1; j >= 0; j--) {
    if (pts >= LEVEL_PTS[j]) { i = j; break }
  }
  return { idx: i, name: LEVELS[i], emoji: LEVEL_EMO[i], next: LEVEL_PTS[i + 1] || null, cur: LEVEL_PTS[i] }
}

function getMedal(i: number) {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return `#${i + 1}`
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
      .eq('user_id', user.id).maybeSingle()
    if (!membership) { setLoading(false); return }
    setHomeName((membership.homes as any)?.name || '')
    const { data } = await supabase
      .from('home_members')
      .select('user_id, profile:profiles(full_name, username, total_points)')
      .eq('home_id', (membership as any).home_id)
      .order('user_id', { ascending: false })
    const list = ((data as any) || []).sort((a: Member, b: Member) => 
      (b.profile?.total_points || 0) - (a.profile?.total_points || 0)
    )
    setMembers(list)
    const mine = list.find((m: Member) => m.user_id === user.id)
    if (mine) setMyPoints(mine.profile?.total_points || 0)
    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadRanking()
    setRefreshing(false)
  }, [])

  if (loading) return <SkeletonScreen />

  const top = members[0]
  const myRank = members.findIndex(m => m.user_id === userId)
  const myLvl = getLevel(myPoints)
  const progressPct = myLvl.next
    ? Math.min(100, ((myPoints - myLvl.cur) / (myLvl.next - myLvl.cur)) * 100)
    : 100

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <Text style={s.headerLabel}>RANKING DEL MES</Text>
        <Text style={s.headerTitle}>{homeName}</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e67e50" />}
      >

        {/* ROOMMATE DEL MES — hero card */}
        {top && (
          <ScaleInView delay={100}>
            <View style={s.heroCard}>
              <View style={s.heroGrad}>
                <View style={s.heroTop}>
                  <View style={s.heroIcon}>
                    <Text style={{ fontSize: 22 }}>🏆</Text>
                  </View>
                  <Text style={s.heroLabel}>Roommate del Mes</Text>
                </View>
                <View style={s.heroBody}>
                  <View style={[s.heroAvatar, { backgroundColor: AVATAR_COLORS[0] }]}>
                    <Text style={s.heroAvatarText}>
                      {(top.profile?.full_name || top.profile?.username || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={s.heroName}>
                      {top.profile?.full_name || top.profile?.username}
                      {top.user_id === userId ? '  (vos 🎉)' : ''}
                    </Text>
                    <View style={s.heroPointsRow}>
                      <Text style={s.heroPointsStar}>★</Text>
                      <Text style={s.heroPoints}>{top.profile?.total_points || 0} puntos</Text>
                    </View>
                    <Text style={s.heroLevel}>
                      {getLevel(top.profile?.total_points || 0).emoji} {getLevel(top.profile?.total_points || 0).name}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ScaleInView>
        )}

        {/* MI POSICIÓN */}
        <View style={s.myCard}>
          <View style={s.myLeft}>
            <Text style={s.myMedal}>{getMedal(myRank)}</Text>
            <View>
              <Text style={s.myLabel}>TU POSICIÓN</Text>
              <Text style={s.myPts}>{myPoints}<Text style={s.myPtsLabel}> pts</Text></Text>
              <Text style={s.myLevel}>{myLvl.emoji} {myLvl.name}</Text>
            </View>
          </View>
          {myLvl.next && (
            <View style={s.myRight}>
              <Text style={s.nextLabel}>AL SIGUIENTE NIVEL</Text>
              <Text style={s.nextVal}>{myLvl.next - myPoints} pts</Text>
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${progressPct}%` }]} />
              </View>
            </View>
          )}
        </View>

        {/* LISTA */}
        <View style={s.listSection}>
          <Text style={s.sectionLabel}>CLASIFICACIÓN COMPLETA</Text>

          {members.map((m, i) => {
            const isMe = m.user_id === userId
            const lvl = getLevel(m.profile?.total_points || m.points || 0)
            
            return (
              <FadeInView key={m.user_id} delay={i * 80}>
                <View style={s.row}>
                  <Text style={s.rowMedal}>{getMedal(i)}</Text>

                  <View style={[s.rowAvatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>
                    <Text style={s.rowAvatarText}>
                      {(m.profile?.full_name || m.profile?.username || '?')[0].toUpperCase()}
                    </Text>
                  </View>

                  <View style={s.rowInfo}>
                    <Text style={[s.rowName, isMe && s.rowNameMe]} numberOfLines={1}>
                      {m.profile?.full_name || m.profile?.username || 'Sin nombre'}
                      {isMe ? ' (vos)' : ''}
                    </Text>
                    <Text style={s.rowLevel}>{lvl.emoji} {lvl.name}</Text>
                  </View>

                  <View style={s.rowRight}>
                    <Text style={[s.rowPts, isMe && s.rowPtsMe]}>{m.profile?.total_points || 0}</Text>
                    <Text style={s.rowPtsLbl}>pts</Text>
                  </View>
                </View>
              </FadeInView>
            )
          })}
        </View>  {/* <- Cerrar el View de listSection */}

        {/* NIVELES */}
        <View style={s.levelsSection}>
          <Text style={s.sectionLabel}>SISTEMA DE NIVELES</Text>
          <View style={s.levelsGrid}>
            {LEVELS.map((name, i) => (
              <View key={name} style={[s.levelChip, myPoints >= LEVEL_PTS[i] && s.levelChipUnlocked]}>
                <Text style={s.levelChipEmo}>{LEVEL_EMO[i]}</Text>
                <Text style={[s.levelChipName, myPoints >= LEVEL_PTS[i] && s.levelChipNameUnlocked]}>
                  {name}
                </Text>
                <Text style={s.levelChipPts}>{LEVEL_PTS[i]}+ pts</Text>
                {myPoints >= LEVEL_PTS[i] && <Text style={s.levelCheck}>✓</Text>}
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#110e0a' },
  center: { flex: 1, backgroundColor: '#110e0a', justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 60, paddingBottom: 18, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: 'rgba(212,165,116,0.1)'
  },
  headerLabel: { fontSize: 10, color: '#5a4a40', letterSpacing: 0.15, marginBottom: 3 },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 22, fontWeight: '700', color: '#f5ede4'
  },
  // HERO
  heroCard: { margin: 20, borderRadius: 20, overflow: 'hidden' },
  heroGrad: {
    backgroundColor: '#8b5a3c',
    padding: 24,
    borderRadius: 20,
    // gradient simulado con overlay
    shadowColor: '#e67e50', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 8
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  heroIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center'
  },
  heroLabel: { fontSize: 16, fontWeight: '800', color: '#fff' },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroAvatar: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)'
  },
  heroAvatarText: { fontSize: 26, fontWeight: '900', color: '#fff' },
  heroName: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroPointsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  heroPointsStar: { fontSize: 16, color: '#ffd700' },
  heroPoints: { fontSize: 18, color: '#fff', fontWeight: '700' },
  heroLevel: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  // MY CARD
  myCard: {
    marginHorizontal: 20, marginBottom: 24,
    backgroundColor: '#1c1712', borderRadius: 16,
    padding: 18, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(230,126,80,0.2)'
  },
  myLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  myMedal: { fontSize: 32 },
  myLabel: { fontSize: 9, color: '#5a4a40', letterSpacing: 0.12, marginBottom: 2 },
  myPts: { fontSize: 26, fontWeight: '900', color: '#e67e50' },
  myPtsLabel: { fontSize: 13, fontWeight: '400', color: '#8a7060' },
  myLevel: { fontSize: 12, color: '#8a7060', marginTop: 2 },
  myRight: { alignItems: 'flex-end' },
  nextLabel: { fontSize: 9, color: '#5a4a40', letterSpacing: 0.1, marginBottom: 2 },
  nextVal: { fontSize: 15, fontWeight: '800', color: '#f5ede4', marginBottom: 6 },
  progressBar: {
    width: 80, height: 4, backgroundColor: '#2e2820',
    borderRadius: 2, overflow: 'hidden'
  },
  progressFill: { height: '100%', backgroundColor: '#e67e50', borderRadius: 2 },
  // LIST
  listSection: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 10, color: '#5a4a40', letterSpacing: 0.15, marginBottom: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1c1712', borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.1)', gap: 12
  },
  rowMe: { borderColor: 'rgba(230,126,80,0.3)', backgroundColor: '#201812' },
  rowMedal: { fontSize: 18, width: 28, textAlign: 'center' },
  rowAvatar: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center'
  },
  rowAvatarText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '700', color: '#f5ede4', marginBottom: 2 },
  rowNameMe: { color: '#e67e50' },
  rowLevel: { fontSize: 11, color: '#5a4a40' },
  rowRight: { alignItems: 'flex-end' },
  rowPts: { fontSize: 18, fontWeight: '900', color: '#f5ede4' },
  rowPtsMe: { color: '#e67e50' },
  rowPtsLbl: { fontSize: 9, color: '#5a4a40', letterSpacing: 0.1 },
  // LEVELS
  levelsSection: { paddingHorizontal: 20, marginTop: 28 },
  levelsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelChip: {
    width: '30.5%', backgroundColor: '#1c1712', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: 'rgba(212,165,116,0.12)',
    position: 'relative', alignItems: 'center'
  },
  levelChipUnlocked: { borderColor: 'rgba(230,126,80,0.3)', backgroundColor: '#201812' },
  levelChipEmo: { fontSize: 22, marginBottom: 4 },
  levelChipName: { fontSize: 12, fontWeight: '700', color: '#5a4a40' },
  levelChipNameUnlocked: { color: '#f5ede4' },
  levelChipPts: { fontSize: 10, color: '#5a4a40', marginTop: 2 },
  levelCheck: {
    position: 'absolute', top: 8, right: 8,
    fontSize: 10, color: '#e67e50', fontWeight: '900'
  }
})