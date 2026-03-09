import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl
} from 'react-native'
import { supabase } from '../../lib/supabase'

type Reward = {
  id: string
  title: string
  description: string
  points_cost: number
  created_by: string
  is_active: boolean
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
  const [claiming, setClaimingId] = useState<string | null>(null)

  // Form
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCost, setNewCost] = useState('50')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: membership } = await supabase
      .from('home_members')
      .select('home_id, points')
      .eq('user_id', user.id)
      .single()

    if (!membership) { setLoading(false); return }

    setHomeId(membership.home_id)
    setMyPoints(membership.points || 0)

    await loadRewards(membership.home_id)
    setLoading(false)
  }

  async function loadRewards(hId: string) {
    const { data } = await supabase
      .from('rewards')
      .select('id, title, description, points_cost, created_by, is_active, creator:profiles!rewards_created_by_fkey(full_name, username)')
      .eq('home_id', hId)
      .eq('is_active', true)
      .order('points_cost', { ascending: true })

    setRewards((data as any) || [])
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [])

  async function createReward() {
    if (!newTitle.trim()) return Alert.alert('Escribí un título para el premio')
    setCreating(true)

    const { error } = await supabase.from('rewards').insert({
      home_id: homeId,
      title: newTitle.trim(),
      description: newDesc.trim(),
      points_cost: parseInt(newCost) || 50,
      created_by: userId
    })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setShowModal(false)
      setNewTitle('')
      setNewDesc('')
      setNewCost('50')
      await loadRewards(homeId)
    }
    setCreating(false)
  }

  async function claimReward(reward: Reward) {
    if (myPoints < reward.points_cost) {
      Alert.alert(
        'Puntos insuficientes',
        `Necesitás ${reward.points_cost} pts pero tenés ${myPoints}. ¡Completá más tareas!`
      )
      return
    }

    Alert.alert(
      `¿Canjear "${reward.title}"?`,
      `Vas a gastar ${reward.points_cost} puntos. Te quedarán ${myPoints - reward.points_cost} pts.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Canjear 🎁',
          onPress: async () => {
            setClaimingId(reward.id)

            // Descontar puntos
            const { error: pointsError } = await supabase
              .from('home_members')
              .update({ points: myPoints - reward.points_cost })
              .eq('user_id', userId)
              .eq('home_id', homeId)

            if (pointsError) {
              Alert.alert('Error', pointsError.message)
              setClaimingId(null)
              return
            }

            // Registrar el canje
            await supabase.from('reward_claims').insert({
              reward_id: reward.id,
              user_id: userId,
              home_id: homeId
            })

            // Registrar en historial de puntos
            await supabase.from('points_log').insert({
              user_id: userId,
              home_id: homeId,
              points: -reward.points_cost,
              reason: `Premio canjeado: ${reward.title}`
            })

            setMyPoints(prev => prev - reward.points_cost)
            setClaimingId(null)
            Alert.alert('🎉 ¡Premio canjeado!', `Disfrutá tu "${reward.title}"`)
          }
        }
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7fff6e" size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>TIENDA DE PREMIOS</Text>
          <Text style={styles.headerTitle}>Tus Recompensas</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsBadgeLabel}>TUS PUNTOS</Text>
          <Text style={styles.pointsBadgeValue}>{myPoints}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7fff6e" />}
      >

        {/* BANNER INFO */}
        <View style={styles.banner}>
          <Text style={styles.bannerEmoji}>💡</Text>
          <Text style={styles.bannerText}>
            Completá tareas para ganar puntos y canjeá premios que vos mismo o tus roommates crean.
          </Text>
        </View>

        {rewards.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🎁</Text>
            <Text style={styles.emptyTitle}>No hay premios todavía</Text>
            <Text style={styles.emptyText}>
              Sé el primero en crear uno para el hogar
            </Text>
          </View>
        )}

        {rewards.length > 0 && (
          <Text style={styles.sectionLabel}>PREMIOS DISPONIBLES</Text>
        )}

        {rewards.map(reward => {
          const canAfford = myPoints >= reward.points_cost
          const isClaiming = claiming === reward.id

          return (
            <View key={reward.id} style={[styles.rewardCard, !canAfford && styles.rewardCardLocked]}>

              <View style={styles.rewardTop}>
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardTitle}>{reward.title}</Text>
                  {reward.description ? (
                    <Text style={styles.rewardDesc}>{reward.description}</Text>
                  ) : null}
                  {reward.creator && (
                    <Text style={styles.rewardCreator}>
                      creado por {reward.creator.full_name || reward.creator.username}
                    </Text>
                  )}
                </View>

                <View style={styles.rewardCost}>
                  <Text style={[styles.rewardCostValue, !canAfford && styles.rewardCostLocked]}>
                    {reward.points_cost}
                  </Text>
                  <Text style={styles.rewardCostLabel}>pts</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.claimBtn, !canAfford && styles.claimBtnLocked, isClaiming && styles.claimBtnLoading]}
                onPress={() => claimReward(reward)}
                disabled={isClaiming}
              >
                {isClaiming ? (
                  <ActivityIndicator color="#0f0f14" size="small" />
                ) : (
                  <Text style={[styles.claimBtnText, !canAfford && styles.claimBtnTextLocked]}>
                    {canAfford ? '🎁 Canjear' : `🔒 Faltan ${reward.points_cost - myPoints} pts`}
                  </Text>
                )}
              </TouchableOpacity>

            </View>
          )
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabText}>+ Crear premio</Text>
      </TouchableOpacity>

      {/* MODAL */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo premio</Text>
            <Text style={styles.modalSubtitle}>
              Creá un premio que el grupo pueda canjear con puntos
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Ej: Elegir la película del viernes 🎬"
              placeholderTextColor="#555"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <TextInput
              style={[styles.input, { height: 70 }]}
              placeholder="Descripción opcional..."
              placeholderTextColor="#555"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />

            <Text style={styles.inputLabel}>COSTO EN PUNTOS</Text>
            <View style={styles.costRow}>
              {['20', '50', '100', '150', '200'].map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.costBtn, newCost === c && styles.costBtnActive]}
                  onPress={() => setNewCost(c)}
                >
                  <Text style={[styles.costBtnText, newCost === c && styles.costBtnTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.btn, creating && styles.btnDisabled]}
              onPress={createReward}
              disabled={creating}
            >
              <Text style={styles.btnText}>
                {creating ? 'Creando...' : 'Crear premio'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f14' },
  center: { flex: 1, backgroundColor: '#0f0f14', justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderBottomWidth: 1, borderBottomColor: '#1a1a24'
  },
  headerLabel: { fontSize: 10, color: '#444', letterSpacing: 0.15, marginBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#f0f0f5', letterSpacing: -0.5 },
  pointsBadge: {
    backgroundColor: '#18181f', borderWidth: 1,
    borderColor: 'rgba(127,255,110,0.25)',
    borderRadius: 10, padding: 12, alignItems: 'center'
  },
  pointsBadgeLabel: { fontSize: 9, color: '#444', letterSpacing: 0.12 },
  pointsBadgeValue: { fontSize: 22, fontWeight: '900', color: '#7fff6e' },
  list: { flex: 1, paddingHorizontal: 20 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#18181f', borderRadius: 10,
    padding: 14, marginTop: 20, marginBottom: 24,
    borderWidth: 1, borderColor: '#2a2a35'
  },
  bannerEmoji: { fontSize: 20 },
  bannerText: { flex: 1, fontSize: 12, color: '#666', lineHeight: 18 },
  sectionLabel: { fontSize: 10, color: '#444', letterSpacing: 0.15, marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#f0f0f5', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#555', textAlign: 'center' },
  rewardCard: {
    backgroundColor: '#18181f', borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a35',
    padding: 18, marginBottom: 12
  },
  rewardCardLocked: { opacity: 0.6 },
  rewardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  rewardInfo: { flex: 1, marginRight: 12 },
  rewardTitle: { fontSize: 15, fontWeight: '800', color: '#f0f0f5', marginBottom: 4 },
  rewardDesc: { fontSize: 12, color: '#555', marginBottom: 4, lineHeight: 17 },
  rewardCreator: { fontSize: 10, color: '#333', marginTop: 2 },
  rewardCost: { alignItems: 'center' },
  rewardCostValue: { fontSize: 24, fontWeight: '900', color: '#7fff6e' },
  rewardCostLocked: { color: '#444' },
  rewardCostLabel: { fontSize: 9, color: '#444', letterSpacing: 0.1 },
  claimBtn: {
    backgroundColor: '#7fff6e', borderRadius: 8,
    padding: 12, alignItems: 'center'
  },
  claimBtnLocked: { backgroundColor: '#18181f', borderWidth: 1, borderColor: '#2a2a35' },
  claimBtnLoading: { opacity: 0.6 },
  claimBtnText: { color: '#0f0f14', fontWeight: '800', fontSize: 14 },
  claimBtnTextLocked: { color: '#555' },
  fab: {
    position: 'absolute', bottom: 80, right: 24, left: 24,
    backgroundColor: '#7fff6e', borderRadius: 12,
    padding: 16, alignItems: 'center'
  },
  fabText: { color: '#0f0f14', fontWeight: '800', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#111118', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 28,
    borderWidth: 1, borderColor: '#1a1a24'
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#f0f0f5', marginBottom: 6, letterSpacing: -0.5 },
  modalSubtitle: { fontSize: 12, color: '#555', marginBottom: 20, lineHeight: 18 },
  input: {
    backgroundColor: '#18181f', color: '#f0f0f5',
    borderWidth: 1, borderColor: '#2a2a35',
    borderRadius: 8, padding: 14, fontSize: 14, marginBottom: 14
  },
  inputLabel: { fontSize: 10, color: '#444', letterSpacing: 0.12, marginBottom: 8 },
  costRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  costBtn: {
    flex: 1, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#2a2a35', alignItems: 'center'
  },
  costBtnActive: { backgroundColor: '#7fff6e', borderColor: '#7fff6e' },
  costBtnText: { fontSize: 13, fontWeight: '700', color: '#666' },
  costBtnTextActive: { color: '#0f0f14' },
  btn: {
    backgroundColor: '#7fff6e', borderRadius: 8,
    padding: 16, alignItems: 'center', marginBottom: 10
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#0f0f14', fontWeight: '800', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelText: { color: '#555', fontSize: 13 }
})