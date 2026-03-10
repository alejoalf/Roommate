import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, RefreshControl, Platform, ActivityIndicator
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { SkeletonScreen, FadeInView, ScaleInView } from '../../components/Animated'

type Reward = {
  id: string; title: string; description: string
  points_cost: number; created_by: string; is_active: boolean
  creator?: { full_name: string; username: string }
}

export default function RewardsScreen() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState('')
  const [homeId, setHomeId] = useState('')
  const [myPoints, setMyPoints] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCost, setNewCost] = useState('50')
  const [claims, setClaims] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: mem } = await supabase
      .from('home_members').select('home_id, points').eq('user_id', user.id).maybeSingle()
    if (!mem) { setLoading(false); return }
    setHomeId(mem.home_id)

    // Cargar total acumulado del perfil
    const { data: profile } = await supabase
      .from('profiles').select('total_points').eq('id', user.id).maybeSingle()
    const totalEarned = profile?.total_points || 0
    const currentSpendable = mem.points || 0

    // Si home_members.points es menor que lo acumulado, sincronizar
    // (pasa cuando las tareas viejas no actualizaron home_members.points)
    if (totalEarned > currentSpendable) {
      await supabase.from('home_members')
        .update({ points: totalEarned })
        .eq('user_id', user.id).eq('home_id', mem.home_id)
      setMyPoints(totalEarned)
    } else {
      setMyPoints(currentSpendable)
    }

    await loadRewards(mem.home_id)
    // Historial de canjes
    const { data: claimsData } = await supabase
      .from('reward_claims')
      .select('id, claimed_at, rewards(title)')
      .eq('user_id', user.id)
      .order('claimed_at', { ascending: false })
      .limit(5)
    setClaims((claimsData as any) || [])
    setLoading(false)
  }

  async function loadRewards(hId: string) {
    const { data } = await supabase
      .from('rewards')
      .select('id, title, description, points_cost, created_by, is_active, creator:profiles!rewards_created_by_fkey(full_name, username)')
      .eq('home_id', hId).eq('is_active', true)
      .order('points_cost', { ascending: true })
    setRewards((data as any) || [])
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await loadData(); setRefreshing(false)
  }, [])

  async function createReward() {
    if (!newTitle.trim()) return Alert.alert('Escribí un título para el premio')
    setCreating(true)
    const { error } = await supabase.from('rewards').insert({
      home_id: homeId, title: newTitle.trim(), description: newDesc.trim(),
      points_cost: parseInt(newCost) || 50, created_by: userId
    })
    if (error) Alert.alert('Error', error.message)
    else { setShowModal(false); setNewTitle(''); setNewDesc(''); setNewCost('50'); await loadRewards(homeId) }
    setCreating(false)
  }

  async function claimReward(r: Reward) {
    if (myPoints < r.points_cost) {
      Alert.alert('Puntos insuficientes', `Necesitás ${r.points_cost} pts pero tenés ${myPoints}. ¡Completá más tareas!`)
      return
    }
    Alert.alert(`¿Canjear "${r.title}"?`, `Vas a gastar ${r.points_cost} pts. Te quedarán ${myPoints - r.points_cost}.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: '🎁 Canjear', onPress: async () => {
          setClaimingId(r.id)
          const { error } = await supabase.from('home_members')
            .update({ points: myPoints - r.points_cost })
            .eq('user_id', userId).eq('home_id', homeId)
          if (error) { Alert.alert('Error', error.message); setClaimingId(null); return }
          await supabase.from('reward_claims').insert({ reward_id: r.id, user_id: userId, home_id: homeId })
          await supabase.from('points_log').insert({
            user_id: userId, home_id: homeId, points: -r.points_cost,
            reason: `Premio canjeado: ${r.title}`
          })
          setMyPoints(p => p - r.points_cost)
          setClaimingId(null)
          Alert.alert('🎉 ¡Premio canjeado!', `Disfrutá tu "${r.title}"`)
          await loadData()
        }
      }
    ])
  }

  if (loading) return <SkeletonScreen />

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.headerLabel}>TIENDA DE PREMIOS</Text>
          <Text style={s.headerTitle}>Recompensas</Text>
        </View>
        <View style={s.ptsBox}>
          <Text style={s.ptsBoxLabel}>TUS PUNTOS</Text>
          <Text style={s.ptsBoxVal}>{myPoints}</Text>
          <Text style={s.ptsBoxSub}>disponibles</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e67e50" />}
      >

        {/* INFO BANNER */}
        <View style={s.banner}>
          <Text style={s.bannerEmoji}>💡</Text>
          <Text style={s.bannerText}>
            Completá tareas para ganar puntos y canjeá los premios que el hogar crea
          </Text>
        </View>

        {/* PREMIOS */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>PREMIOS DISPONIBLES</Text>

          {rewards.length === 0 && (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>🎁</Text>
              <Text style={s.emptyTitle}>No hay premios todavía</Text>
              <Text style={s.emptyText}>Sé el primero en crear uno para el hogar</Text>
            </View>
          )}

          {rewards.map(r => {
            const canAfford = myPoints >= r.points_cost
            const isClaiming = claimingId === r.id
            return (
              <View key={r.id} style={[s.rewardCard, !canAfford && s.rewardLocked]}>
                <View style={s.rewardTop}>
                  <View style={s.rewardInfo}>
                    <Text style={s.rewardTitle}>{r.title}</Text>
                    {r.description ? <Text style={s.rewardDesc}>{r.description}</Text> : null}
                    {r.creator && (
                      <Text style={s.rewardCreator}>
                        creado por {r.creator.full_name || r.creator.username}
                      </Text>
                    )}
                  </View>
                  <View style={s.rewardCostBox}>
                    <Text style={[s.rewardCostVal, !canAfford && { color: '#5a4a40' }]}>
                      {r.points_cost}
                    </Text>
                    <Text style={s.rewardCostLbl}>pts</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[s.claimBtn, !canAfford && s.claimBtnLocked, isClaiming && { opacity: 0.6 }]}
                  onPress={() => claimReward(r)} disabled={isClaiming}
                >
                  {isClaiming
                    ? <ActivityIndicator color={canAfford ? '#fff' : '#5a4a40'} size="small" />
                    : <Text style={[s.claimBtnText, !canAfford && s.claimBtnTextLocked]}>
                      {canAfford ? '🎁 Canjear' : `🔒 Faltan ${r.points_cost - myPoints} pts`}
                    </Text>
                  }
                </TouchableOpacity>
              </View>
            )
          })}
        </View>

        {/* HISTORIAL DE CANJES */}
        {claims.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>MIS CANJES RECIENTES</Text>
            {claims.map(c => (
              <View key={c.id} style={s.claimRow}>
                <Text style={s.claimEmoji}>🎁</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.claimTitle}>{c.rewards?.title}</Text>
                  <Text style={s.claimDate}>
                    {new Date(c.claimed_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowModal(true)}>
        <Text style={s.fabText}>+ Crear Premio</Text>
      </TouchableOpacity>

      {/* MODAL */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Nuevo Premio</Text>
            <Text style={s.modalSub}>Creá un premio que el grupo pueda canjear con puntos</Text>

            <TextInput style={s.input} placeholder='Ej: "Elegir la película del viernes 🎬"'
              placeholderTextColor="#5a4a40" value={newTitle} onChangeText={setNewTitle} />
            <TextInput style={[s.input, { height: 70 }]} placeholder="Descripción opcional..."
              placeholderTextColor="#5a4a40" value={newDesc} onChangeText={setNewDesc} multiline />

            <Text style={s.fieldLabel}>COSTO EN PUNTOS</Text>
            <View style={s.costsRow}>
              {['20', '50', '100', '150', '200'].map(c => (
                <TouchableOpacity key={c}
                  style={[s.costBtn, newCost === c && s.costBtnActive]}
                  onPress={() => setNewCost(c)}>
                  <Text style={[s.costBtnText, newCost === c && s.costBtnTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[s.btn, creating && { opacity: 0.5 }]}
              onPress={createReward} disabled={creating}>
              <Text style={s.btnText}>{creating ? 'Creando...' : 'Crear Premio'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={s.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#110e0a' },
  center: { flex: 1, backgroundColor: '#110e0a', justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 60, paddingBottom: 18, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderBottomWidth: 1, borderBottomColor: 'rgba(212,165,116,0.1)'
  },
  headerLabel: { fontSize: 10, color: '#5a4a40', letterSpacing: 0.15, marginBottom: 3 },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 22, fontWeight: '700', color: '#f5ede4'
  },
  ptsBox: {
    backgroundColor: '#1c1712', borderRadius: 12,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(230,126,80,0.25)'
  },
  ptsBoxLabel: { fontSize: 8, color: '#5a4a40', letterSpacing: 0.12 },
  ptsBoxVal: { fontSize: 24, fontWeight: '900', color: '#e67e50' },
  ptsBoxSub: { fontSize: 9, color: '#8a7060' },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1c1712', margin: 20,
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.12)'
  },
  bannerEmoji: { fontSize: 20 },
  bannerText: { flex: 1, fontSize: 12, color: '#8a7060', lineHeight: 18 },
  section: { paddingHorizontal: 20, marginBottom: 16 },
  sectionLabel: { fontSize: 10, color: '#5a4a40', letterSpacing: 0.15, marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#f5ede4', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#5a4a40', textAlign: 'center' },
  rewardCard: {
    backgroundColor: '#1c1712', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.12)',
    padding: 18, marginBottom: 12
  },
  rewardLocked: { opacity: 0.55 },
  rewardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  rewardInfo: { flex: 1, marginRight: 12 },
  rewardTitle: { fontSize: 15, fontWeight: '800', color: '#f5ede4', marginBottom: 4 },
  rewardDesc: { fontSize: 12, color: '#8a7060', marginBottom: 4, lineHeight: 17 },
  rewardCreator: { fontSize: 10, color: '#5a4a40', marginTop: 2 },
  rewardCostBox: { alignItems: 'center' },
  rewardCostVal: { fontSize: 26, fontWeight: '900', color: '#e67e50' },
  rewardCostLbl: { fontSize: 9, color: '#5a4a40', letterSpacing: 0.1 },
  claimBtn: {
    backgroundColor: '#e67e50', borderRadius: 10,
    padding: 12, alignItems: 'center'
  },
  claimBtnLocked: { backgroundColor: '#1c1712', borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)' },
  claimBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  claimBtnTextLocked: { color: '#5a4a40' },
  claimRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,165,116,0.08)'
  },
  claimEmoji: { fontSize: 20 },
  claimTitle: { fontSize: 13, fontWeight: '600', color: '#f5ede4' },
  claimDate: { fontSize: 11, color: '#5a4a40', marginTop: 2 },
  fab: {
    position: 'absolute', bottom: 80, right: 20, left: 20,
    backgroundColor: '#e67e50', borderRadius: 14,
    padding: 16, alignItems: 'center',
    shadowColor: '#e67e50', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8
  },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#1c1712', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)'
  },
  modalTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 20, fontWeight: '700', color: '#f5ede4', marginBottom: 4
  },
  modalSub: { fontSize: 12, color: '#8a7060', marginBottom: 18 },
  input: {
    backgroundColor: '#242018', color: '#f5ede4',
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.2)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, marginBottom: 14
  },
  fieldLabel: { fontSize: 10, color: '#8a7060', letterSpacing: 0.12, marginBottom: 8 },
  costsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  costBtn: {
    flex: 1, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)', alignItems: 'center'
  },
  costBtnActive: { backgroundColor: '#e67e50', borderColor: '#e67e50' },
  costBtnText: { fontSize: 13, fontWeight: '700', color: '#8a7060' },
  costBtnTextActive: { color: '#fff' },
  btn: {
    backgroundColor: '#e67e50', borderRadius: 10,
    padding: 15, alignItems: 'center', marginBottom: 10
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelText: { color: '#5a4a40', fontSize: 13 },
})