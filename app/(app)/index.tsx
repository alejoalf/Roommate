import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl, Platform
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { sendLocalNotification, scheduleTaskReminder } from '../../lib/notifications'

const CATEGORIES = ['General', 'Cocina', 'Baño', 'Sala', 'Lavandería', 'Patio', 'Compras']
const CAT_COLORS: Record<string, string> = {
  General: '#8a7060', Cocina: '#e67e50', Baño: '#6ba3c8',
  Sala: '#9b7ec8', Lavandería: '#6bbaa8', Patio: '#7ecb6e', Compras: '#d4a574'
}

type Task = {
  id: string; title: string; description: string; points: number
  status: string; assigned_to: string | null; due_date: string | null
  category: string; assignee?: { full_name: string; username: string }
}

type Home = { id: string; name: string; invite_code: string }

function isOverdue(task: Task) {
  if (task.status !== 'pending') return false
  if (!task.due_date) return false
  return new Date(task.due_date) < new Date()
}

export default function TasksScreen() {
  const [home, setHome] = useState<Home | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPoints, setNewPoints] = useState('20')
  const [newCategory, setNewCategory] = useState('General')
  const [assignedTo, setAssignedTo] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'all' | 'mine' | 'pending' | 'done'>('all')
  const [showPrendas, setShowPrendas] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: membership } = await supabase
      .from('home_members')
      .select('home_id, homes(id, name, invite_code)')
      .eq('user_id', user.id).single()
    if (!membership) { setLoading(false); return }
    const homeData = membership.homes as any
    setHome(homeData)
    const { data: memberData } = await supabase
      .from('home_members')
      .select('user_id, profiles(id, full_name, username)')
      .eq('home_id', homeData.id)
    setMembers(memberData?.map((m: any) => m.profiles) || [])
    await loadTasks(homeData.id)
    setLoading(false)
  }

  async function loadTasks(homeId: string) {
    const { data } = await supabase
      .from('tasks')
      .select(`id, title, description, points, status, assigned_to, due_date, category,
        assignee:profiles!tasks_assigned_to_fkey(full_name, username)`)
      .eq('home_id', homeId)
      .order('created_at', { ascending: false })
    const updated = (data as any || []).map((t: Task) =>
      isOverdue(t) ? { ...t, status: 'overdue' } : t
    )
    setTasks(updated)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [])

  async function createTask() {
    if (!newTitle.trim()) return Alert.alert('Escribí un título para la tarea')
    if (!home) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('tasks').insert({
      home_id: home.id, title: newTitle.trim(), description: newDesc.trim(),
      points: parseInt(newPoints) || 20, assigned_to: assignedTo || null,
      created_by: user?.id, status: 'pending', category: newCategory,
      due_date: newDueDate || null  // ✅ Ya está
    }).select('id').single()
    
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      // Notificación de tarea creada
      await sendLocalNotification(
        '✅ Tarea creada',
        `"${newTitle.trim()}" fue agregada al hogar`
      )

      // Programar recordatorio si tiene fecha límite
      if (newDueDate && data?.id) {
        await scheduleTaskReminder(newTitle.trim(), new Date(newDueDate), data.id)
      }

      setShowModal(false)
      setNewTitle(''); setNewDesc(''); setNewPoints('20')
      setNewCategory('General'); setAssignedTo(''); setNewDueDate('')
      await loadTasks(home.id)
    }
    setCreating(false)
  }

  async function completeTask(task: Task) {
    if (task.status === 'completed' || task.status === 'verified') return
    Alert.alert(
      '¿Completaste esta tarea?',
      `Vas a ganar ${task.points} pts por "${task.title}"`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `¡Listo! +${task.points} pts ✅`,
          onPress: async () => {
            await supabase.from('tasks')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', task.id)
            if (home) {
              await supabase.rpc('add_points', {
                p_user_id: userId, p_home_id: home.id,
                p_task_id: task.id, p_points: task.points
              })
              
              // Notificación de tarea completada
              await sendLocalNotification(
                `🎉 +${task.points} puntos`,
                `Completaste "${task.title}". ¡Bien hecho!`
              )
              
              await loadTasks(home.id)
            }
          }
        }
      ]
    )
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'mine') return t.assigned_to === userId
    if (filter === 'pending') return t.status === 'pending' || t.status === 'overdue'
    if (filter === 'done') return t.status === 'completed' || t.status === 'verified'
    return true
  })

  const overdueTasks = tasks.filter(t => t.status === 'overdue')
  const pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'overdue').length

  const statusColor = (status: string) => {
    if (status === 'completed' || status === 'verified') return '#7ecb6e'
    if (status === 'overdue') return '#c64747'
    return '#d4a574'
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator color="#e67e50" size="large" /></View>
  )

  if (!home) return (
    <View style={s.center}>
      <Text style={{ fontSize: 40 }}>🏠</Text>
      <Text style={s.emptyTitle}>No estás en ningún hogar</Text>
    </View>
  )

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.headerLabel}>TAREAS DEL HOGAR</Text>
          <Text style={s.headerTitle}>{home.name}</Text>
          <Text style={s.headerSub}>{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={s.codeBox} onPress={() => Alert.alert('Código de invitación', `Compartí este código con tus roommates:\n\n${home.invite_code}`)}>
          <Text style={s.codeLabel}>CÓDIGO</Text>
          <Text style={s.codeValue}>{home.invite_code}</Text>
          <Text style={s.codeTap}>toca para ver</Text>
        </TouchableOpacity>
      </View>

      {/* PRENDAS BANNER */}
      {overdueTasks.length > 0 && (
        <TouchableOpacity style={s.prendasBanner} onPress={() => setShowPrendas(true)} activeOpacity={0.8}>
          <Text style={s.prendasEmoji}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.prendasTitle}>Prendas Activas</Text>
            <Text style={s.prendasSub}>{overdueTasks.length} tarea{overdueTasks.length !== 1 ? 's' : ''} vencida{overdueTasks.length !== 1 ? 's' : ''} — toca para ver</Text>
          </View>
          <Text style={s.prendasArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* FILTROS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {(['all', 'mine', 'pending', 'done'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterBtn, filter === f && s.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {f === 'all' ? 'Todas' : f === 'mine' ? 'Mis tareas' : f === 'pending' ? 'Pendientes' : 'Hechas'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* LISTA */}
      <ScrollView
        style={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e67e50" />}
      >
        {filteredTasks.length === 0 && (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40 }}>🎉</Text>
            <Text style={s.emptyTitle}>¡Todo al día!</Text>
            <Text style={s.emptyText}>No hay tareas en esta vista</Text>
          </View>
        )}

        {filteredTasks.map(task => {
          const done = task.status === 'completed' || task.status === 'verified'
          const overdue = task.status === 'overdue'
          const catColor = CAT_COLORS[task.category] || '#8a7060'

          return (
            <TouchableOpacity
              key={task.id}
              style={[
                s.taskCard,
                done && s.taskCardDone,
                overdue && s.taskCardOverdue
              ]}
              onPress={() => completeTask(task)}
              activeOpacity={0.75}
            >
              <View style={s.taskTop}>
                {/* Status dot */}
                <View style={[s.statusDot, { backgroundColor: statusColor(task.status) }]} />

                <View style={{ flex: 1 }}>
                  <View style={s.taskTitleRow}>
                    <Text style={[s.taskTitle, done && s.taskTitleDone]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <View style={s.taskPts}>
                      <Text style={[s.taskPtsVal, { color: done ? '#7ecb6e' : '#d4a574' }]}>+{task.points}</Text>
                      <Text style={s.taskPtsLabel}>pts</Text>
                    </View>
                  </View>

                  <View style={s.taskMeta}>
                    <View style={[s.catTag, { backgroundColor: catColor + '18', borderColor: catColor + '40' }]}>
                      <Text style={[s.catText, { color: catColor }]}>{task.category}</Text>
                    </View>
                    {task.assignee && (
                      <Text style={s.assigneeText}>
                        👤 {task.assignee.full_name || task.assignee.username}
                      </Text>
                    )}
                    {task.due_date && (
                      <Text style={[s.dateText, overdue && { color: '#c64747' }]}>
                        📅 {new Date(task.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Action button for pending */}
              {task.status === 'pending' && (
                <TouchableOpacity style={s.completeBtn} onPress={() => completeTask(task)}>
                  <Text style={s.completeBtnText}>Marcar como completada</Text>
                </TouchableOpacity>
              )}
              {overdue && (
                <View style={s.overdueTag}>
                  <Text style={s.overdueText}>⚠️ Vencida — se generó una prenda</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowModal(true)}>
        <Text style={s.fabText}>+ Nueva Tarea</Text>
      </TouchableOpacity>

      {/* MODAL NUEVA TAREA */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Nueva Tarea</Text>

            <TextInput style={s.input} placeholder="¿Qué hay que hacer? *"
              placeholderTextColor="#5a4a40" value={newTitle} onChangeText={setNewTitle} />
            <TextInput style={[s.input, { height: 70 }]} placeholder="Descripción opcional..."
              placeholderTextColor="#5a4a40" value={newDesc} onChangeText={setNewDesc} multiline />

            <Text style={s.fieldLabel}>CATEGORÍA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}
              contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat}
                  style={[s.catBtn, newCategory === cat && { backgroundColor: CAT_COLORS[cat] + '30', borderColor: CAT_COLORS[cat] }]}
                  onPress={() => setNewCategory(cat)}>
                  <Text style={[s.catBtnText, newCategory === cat && { color: CAT_COLORS[cat], fontWeight: '700' }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>PUNTOS</Text>
            <View style={s.row}>
              {['10', '20', '30', '50', '80'].map(p => (
                <TouchableOpacity key={p}
                  style={[s.ptBtn, newPoints === p && s.ptBtnActive]}
                  onPress={() => setNewPoints(p)}>
                  <Text style={[s.ptBtnText, newPoints === p && s.ptBtnTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>FECHA LÍMITE (opcional)</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD  Ej: 2026-03-15"
              placeholderTextColor="#5a4a40"
              value={newDueDate}
              onChangeText={setNewDueDate}
/>

            <Text style={s.fieldLabel}>ASIGNAR A</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}
              contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity style={[s.memberBtn, assignedTo === '' && s.memberBtnActive]}
                onPress={() => setAssignedTo('')}>
                <Text style={s.memberBtnText}>Nadie</Text>
              </TouchableOpacity>
              {members.map(m => (
                <TouchableOpacity key={m.id}
                  style={[s.memberBtn, assignedTo === m.id && s.memberBtnActive]}
                  onPress={() => setAssignedTo(m.id)}>
                  <Text style={s.memberBtnText}>{m.full_name || m.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[s.btn, creating && { opacity: 0.5 }]}
              onPress={createTask} disabled={creating}>
              <Text style={s.btnText}>{creating ? 'Creando...' : 'Crear Tarea'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={s.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL PRENDAS */}
      <Modal visible={showPrendas} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>⚠️ Prendas Activas</Text>
            <Text style={[s.fieldLabel, { marginBottom: 16 }]}>
              Estas tareas vencieron y generaron prendas para sus responsables
            </Text>
            {overdueTasks.map(task => (
              <View key={task.id} style={s.prendaCard}>
                <Text style={s.prendaTitle}>{task.title}</Text>
                {task.assignee && (
                  <Text style={s.prendaWho}>
                    👤 {task.assignee.full_name || task.assignee.username} debe completarla
                  </Text>
                )}
                <Text style={s.prendaTag}>🎯 Prenda: completar la tarea vencida</Text>
              </View>
            ))}
            <TouchableOpacity style={[s.btn, { backgroundColor: '#2e2820', marginTop: 8 }]}
              onPress={() => setShowPrendas(false)}>
              <Text style={[s.btnText, { color: '#f5ede4' }]}>Cerrar</Text>
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
    fontSize: 22, fontWeight: '700', color: '#f5ede4', letterSpacing: -0.3
  },
  headerSub: { fontSize: 12, color: '#8a7060', marginTop: 2 },
  codeBox: {
    backgroundColor: '#1c1712', borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.2)', borderRadius: 10,
    padding: 10, alignItems: 'center', minWidth: 80
  },
  codeLabel: { fontSize: 8, color: '#5a4a40', letterSpacing: 0.12 },
  codeValue: { fontSize: 15, fontWeight: '800', color: '#d4a574', letterSpacing: 3 },
  codeTap: { fontSize: 8, color: '#5a4a40', marginTop: 2 },
  prendasBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginTop: 14,
    backgroundColor: 'rgba(198,71,71,0.08)',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(198,71,71,0.2)', gap: 12
  },
  prendasEmoji: { fontSize: 22 },
  prendasTitle: { fontSize: 13, fontWeight: '800', color: '#f5ede4', marginBottom: 2 },
  prendasSub: { fontSize: 11, color: '#c64747' },
  prendasArrow: { fontSize: 22, color: '#c64747' },
  filterRow: { flexGrow: 0, paddingVertical: 14 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)'
  },
  filterBtnActive: { backgroundColor: '#e67e50', borderColor: '#e67e50' },
  filterText: { fontSize: 12, color: '#8a7060', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  list: { flex: 1, paddingHorizontal: 20 },
  taskCard: {
    backgroundColor: '#1c1712', borderRadius: 14,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.12)'
  },
  taskCardDone: { opacity: 0.55, borderColor: 'rgba(126,203,110,0.15)' },
  taskCardOverdue: { borderColor: 'rgba(198,71,71,0.25)', backgroundColor: '#1e1210' },
  taskTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  taskTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  taskTitle: { fontSize: 14, fontWeight: '700', color: '#f5ede4', flex: 1, marginRight: 8 },
  taskTitleDone: { textDecorationLine: 'line-through', color: '#5a4a40' },
  taskPts: { alignItems: 'flex-end' },
  taskPtsVal: { fontSize: 15, fontWeight: '900' },
  taskPtsLabel: { fontSize: 8, color: '#5a4a40' },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  catTag: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1
  },
  catText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.05 },
  assigneeText: { fontSize: 11, color: '#8a7060' },
  dateText: { fontSize: 11, color: '#8a7060' },
  completeBtn: {
    marginTop: 12, paddingVertical: 9,
    backgroundColor: 'rgba(230,126,80,0.12)',
    borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(230,126,80,0.25)', alignItems: 'center'
  },
  completeBtnText: { fontSize: 12, fontWeight: '700', color: '#e67e50' },
  overdueTag: {
    marginTop: 10, paddingVertical: 7, paddingHorizontal: 10,
    backgroundColor: 'rgba(198,71,71,0.08)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(198,71,71,0.2)'
  },
  overdueText: { fontSize: 11, color: '#c64747' },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#f5ede4' },
  emptyText: { fontSize: 13, color: '#5a4a40' },
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
    fontSize: 20, fontWeight: '700', color: '#f5ede4', marginBottom: 18
  },
  input: {
    backgroundColor: '#242018', color: '#f5ede4',
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.2)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, marginBottom: 14
  },
  fieldLabel: { fontSize: 10, color: '#8a7060', letterSpacing: 0.12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  ptBtn: {
    flex: 1, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)', alignItems: 'center'
  },
  ptBtnActive: { backgroundColor: '#e67e50', borderColor: '#e67e50' },
  ptBtnText: { fontSize: 13, fontWeight: '700', color: '#8a7060' },
  ptBtnTextActive: { color: '#fff' },
  catBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)'
  },
  catBtnText: { fontSize: 12, color: '#8a7060', fontWeight: '600' },
  memberBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)'
  },
  memberBtnActive: { borderColor: '#e67e50', backgroundColor: 'rgba(230,126,80,0.08)' },
  memberBtnText: { fontSize: 12, color: '#8a7060', fontWeight: '600' },
  btn: {
    backgroundColor: '#e67e50', borderRadius: 10,
    padding: 15, alignItems: 'center', marginBottom: 10
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelText: { color: '#5a4a40', fontSize: 13 },
  prendaCard: {
    backgroundColor: 'rgba(198,71,71,0.06)', borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(198,71,71,0.2)'
  },
  prendaTitle: { fontSize: 14, fontWeight: '700', color: '#f5ede4', marginBottom: 4 },
  prendaWho: { fontSize: 12, color: '#8a7060', marginBottom: 6 },
  prendaTag: { fontSize: 12, color: '#c64747', fontWeight: '600' },
})