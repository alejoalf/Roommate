import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Platform
} from 'react-native'
import { useRouter } from 'expo-router'
import { clearPersistedAuthSession, supabase } from '../../lib/supabase'

type Profile = { id: string; full_name: string; username: string; total_points: number }
type Log = { id: string; points: number; reason: string; created_at: string }

const LEVELS = ['Novato', 'Aprendiz', 'Habitante', 'Pro', 'Experto', 'Leyenda']
const LEVEL_PTS = [0, 50, 150, 300, 500, 1000]
const LEVEL_EMO = ['🌱', '⚡', '🏠', '🔥', '💎', '👑']

function getLevel(pts: number) {
  let i = 0
  for (let j = LEVEL_PTS.length - 1; j >= 0; j--) {
    if (pts >= LEVEL_PTS[j]) { i = j; break }
  }
  return { idx: i, name: LEVELS[i], emoji: LEVEL_EMO[i], next: LEVEL_PTS[i + 1] || null, cur: LEVEL_PTS[i] }
}

function getBadges(totalPts: number, tasksDone: number, rewardsClaimed: number) {
  return [
    { id: '1', emoji: '🎯', name: 'Primer Paso', desc: 'Completá tu primera tarea', unlocked: tasksDone >= 1 },
    { id: '2', emoji: '🔥', name: 'En Racha', desc: 'Completá 5 tareas', unlocked: tasksDone >= 5 },
    { id: '3', emoji: '💪', name: 'Trabajador', desc: 'Completá 20 tareas', unlocked: tasksDone >= 20 },
    { id: '4', emoji: '⭐', name: 'Acumulador', desc: 'Juntá 100 puntos', unlocked: totalPts >= 100 },
    { id: '5', emoji: '💎', name: 'Élite', desc: 'Juntá 500 puntos', unlocked: totalPts >= 500 },
    { id: '6', emoji: '🎁', name: 'Comprador', desc: 'Canjeá tu primer premio', unlocked: rewardsClaimed >= 1 },
    { id: '7', emoji: '🏆', name: 'Campeón', desc: 'Canjeá 5 premios', unlocked: rewardsClaimed >= 5 },
    { id: '8', emoji: '👑', name: 'Leyenda', desc: 'Alcanzá 1000 puntos', unlocked: totalPts >= 1000 },
  ]
}

export default function ProfileScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [homePoints, setHomePoints] = useState(0)
  const [homeName, setHomeName] = useState('')
  const [myRank, setMyRank] = useState(0)
  const [logs, setLogs] = useState<Log[]>([])
  const [tasksDone, setTasksDone] = useState(0)
  const [rewardsClaimed, setRewardsClaimed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'badges' | 'history'>('badges')
  const [completionRate, setCompletionRate] = useState(0)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles').select('id, full_name, username, total_points')
      .eq('id', user.id).maybeSingle()
    if (prof) setProfile(prof as Profile)

    const { data: mem } = await supabase
      .from('home_members').select('points, home_id, homes(name)')
      .eq('user_id', user.id).maybeSingle()
    if (mem) {
      setHomePoints(mem.points || 0)
      setHomeName((mem.homes as any)?.name || '')
      // Calcular ranking
      const { data: allMembers } = await supabase
        .from('home_members').select('user_id, points')
        .eq('home_id', (mem as any).home_id).order('points', { ascending: false })
      const rank = (allMembers || []).findIndex((m: any) => m.user_id === user.id)
      setMyRank(rank + 1)
    }

    const { data: logsData } = await supabase
      .from('points_log').select('id, points, reason, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
    setLogs((logsData as any) || [])

    const { count: total } = await supabase
      .from('tasks').select('id', { count: 'exact' }).eq('assigned_to', user.id)
    const { count: done } = await supabase
      .from('tasks').select('id', { count: 'exact' })
      .eq('assigned_to', user.id).in('status', ['completed', 'verified'])
    setTasksDone(done || 0)
    setCompletionRate(total ? Math.round(((done || 0) / total) * 100) : 0)

    const { count: rCount } = await supabase
      .from('reward_claims').select('id', { count: 'exact' }).eq('user_id', user.id)
    setRewardsClaimed(rCount || 0)

    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await loadData(); setRefreshing(false)
  }, [])

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  async function handleSignOut() {
    // Usar signOut simple - el evento SIGNED_OUT en _layout va a redirigir
    await supabase.auth.signOut()
  }

  function handleLogoutPress() {
    if (Platform.OS === 'web') {
      const confirmed = globalThis.confirm('¿Estás seguro que querés cerrar sesión?')
      if (confirmed) {
        void handleSignOut()
      }
      return
    }

    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => { void handleSignOut() } }
    ])
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator color="#e67e50" size="large" /></View>
  )

  const lvl = getLevel(profile?.total_points || 0)
  const badges = getBadges(profile?.total_points || 0, tasksDone, rewardsClaimed)
  const unlockedCount = badges.filter(b => b.unlocked).length
  const progressPct = lvl.next
    ? Math.min(100, (((profile?.total_points || 0) - lvl.cur) / (lvl.next - lvl.cur)) * 100) : 100
  const medalEmoji = myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `#${myRank}`

  return (
    <View style={s.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e67e50" />}
      >

        {/* HERO HEADER — gradiente cálido */}
        <View style={s.hero}>
          <View style={s.heroInner}>
            <View style={s.heroLeft}>
              <View style={s.avatarWrap}>
                <Text style={s.avatarText}>
                  {(profile?.full_name || profile?.username || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View>
                <View style={s.heroNameRow}>
                  <Text style={s.heroName}>{profile?.full_name || 'Sin nombre'}</Text>
                  {myRank <= 3 && myRank > 0 && (
                    <View style={s.topBadge}>
                      <Text style={s.topBadgeText}>🏆 Top Roommate</Text>
                    </View>
                  )}
                </View>
                <Text style={s.heroUsername}>@{profile?.username || 'usuario'}</Text>
                <Text style={s.heroHome}>🏠 {homeName}</Text>
              </View>
            </View>
          </View>

          {/* STATS ROW */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statVal}>{profile?.total_points || 0}</Text>
              <Text style={s.statLbl}>Puntos</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{medalEmoji}</Text>
              <Text style={s.statLbl}>Ranking</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{tasksDone}</Text>
              <Text style={s.statLbl}>Tareas</Text>
            </View>
          </View>
        </View>

        {/* NIVEL + PROGRESO */}
        <View style={s.levelCard}>
          <View style={s.levelTop}>
            <Text style={s.levelCurrent}>{lvl.emoji} {lvl.name}</Text>
            {lvl.next && (
              <Text style={s.levelNext}>{lvl.next - (profile?.total_points || 0)} pts para {LEVEL_EMO[lvl.idx + 1]} {LEVELS[lvl.idx + 1]}</Text>
            )}
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${progressPct}%` }]} />
          </View>
          {/* Completion rate */}
          <View style={s.rateRow}>
            <Text style={s.rateLabel}>Tasa de completitud</Text>
            <Text style={s.rateVal}>{completionRate}%</Text>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${completionRate}%`, backgroundColor: '#7ecb6e' }]} />
          </View>
        </View>

        {/* TABS */}
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'badges' && s.tabBtnActive]}
            onPress={() => setTab('badges')}>
            <Text style={[s.tabText, tab === 'badges' && s.tabTextActive]}>
              🏅 Logros ({unlockedCount}/{badges.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'history' && s.tabBtnActive]}
            onPress={() => setTab('history')}>
            <Text style={[s.tabText, tab === 'history' && s.tabTextActive]}>
              📋 Historial
            </Text>
          </TouchableOpacity>
        </View>

        <View style={s.content}>

          {/* BADGES */}
          {tab === 'badges' && (
            <View style={s.badgesGrid}>
              {badges.map(b => (
                <View key={b.id} style={[s.badgeCard, !b.unlocked && s.badgeLocked]}>
                  <Text style={[s.badgeEmoji, !b.unlocked && { opacity: 0.2 }]}>{b.emoji}</Text>
                  <Text style={[s.badgeName, !b.unlocked && { color: '#5a4a40' }]}>{b.name}</Text>
                  <Text style={s.badgeDesc}>{b.desc}</Text>
                  {b.unlocked && (
                    <View style={s.badgeCheck}>
                      <Text style={{ fontSize: 9, color: '#e67e50', fontWeight: '900' }}>✓</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* HISTORIAL */}
          {tab === 'history' && (
            <View>
              {logs.length === 0 && (
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                  <Text style={{ color: '#5a4a40', fontSize: 13 }}>No hay historial todavía</Text>
                </View>
              )}
              {logs.map(log => (
                <View key={log.id} style={s.logRow}>
                  <Text style={s.logEmoji}>{log.points > 0 ? '⬆️' : '⬇️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.logReason} numberOfLines={1}>{log.reason}</Text>
                    <Text style={s.logDate}>{fmtDate(log.created_at)}</Text>
                  </View>
                  <Text style={[s.logPts, log.points < 0 && { color: '#c64747' }]}>
                    {log.points > 0 ? '+' : ''}{log.points}
                  </Text>
                </View>
              ))}
            </View>
          )}

        </View>

        {/* LOGOUT */}
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={handleLogoutPress}
        >
          <Text style={s.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#110e0a' },
  center: { flex: 1, backgroundColor: '#110e0a', justifyContent: 'center', alignItems: 'center' },
  // HERO
  hero: {
    backgroundColor: '#8b5a3c',
    paddingTop: 60, paddingBottom: 0, paddingHorizontal: 20,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    shadowColor: '#8b5a3c', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    marginBottom: 16
  },
  heroInner: { marginBottom: 20 },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center'
  },
  avatarText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 },
  heroName: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 20, fontWeight: '700', color: '#fff'
  },
  topBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10
  },
  topBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  heroUsername: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  heroHome: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)'
  },
  statItem: { alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 2 },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.05 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  // LEVEL CARD
  levelCard: {
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: '#1c1712', borderRadius: 14,
    padding: 18, borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)'
  },
  levelTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  levelCurrent: { fontSize: 14, fontWeight: '700', color: '#e67e50' },
  levelNext: { fontSize: 11, color: '#8a7060' },
  progressBar: { height: 5, backgroundColor: '#2e2820', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', backgroundColor: '#e67e50', borderRadius: 3 },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rateLabel: { fontSize: 11, color: '#8a7060' },
  rateVal: { fontSize: 11, fontWeight: '700', color: '#7ecb6e' },
  // TABS
  tabs: {
    flexDirection: 'row', marginHorizontal: 20,
    gap: 8, marginBottom: 16
  },
  tabBtn: {
    flex: 1, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.12)', alignItems: 'center'
  },
  tabBtnActive: { backgroundColor: '#1c1712', borderColor: '#e67e50' },
  tabText: { fontSize: 12, color: '#5a4a40', fontWeight: '600' },
  tabTextActive: { color: '#e67e50' },
  content: { paddingHorizontal: 20 },
  // BADGES
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard: {
    width: '47%', backgroundColor: '#1c1712',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.12)', position: 'relative'
  },
  badgeLocked: { opacity: 0.45 },
  badgeEmoji: { fontSize: 26, marginBottom: 8 },
  badgeName: { fontSize: 13, fontWeight: '800', color: '#f5ede4', marginBottom: 3 },
  badgeDesc: { fontSize: 11, color: '#5a4a40', lineHeight: 15 },
  badgeCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(230,126,80,0.15)',
    borderWidth: 1, borderColor: '#e67e50',
    justifyContent: 'center', alignItems: 'center'
  },
  // HISTORIAL
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,165,116,0.08)'
  },
  logEmoji: { fontSize: 16 },
  logReason: { fontSize: 13, color: '#f5ede4', fontWeight: '600', flex: 1 },
  logDate: { fontSize: 11, color: '#5a4a40', marginTop: 2 },
  logPts: { fontSize: 16, fontWeight: '900', color: '#e67e50' },
  // LOGOUT
  logoutBtn: {
    margin: 20, marginTop: 28, padding: 14,
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)',
    borderRadius: 10, alignItems: 'center'
  },
  logoutText: { color: '#c64747', fontWeight: '700', fontSize: 13 },
})