import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl
} from 'react-native'
import { supabase } from '../../lib/supabase'

type Task = {
  id: string
  title: string
  description: string
  points: number
  status: string
  assigned_to: string | null
  due_date: string | null
  assignee?: { full_name: string; username: string }
}

type Home = {
  id: string
  name: string
  invite_code: string
}

export default function TasksScreen() {
  const [home, setHome] = useState<Home | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [members, setMembers] = useState<any[]>([])

  // Modal nueva tarea
  const [showModal, setShowModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPoints, setNewPoints] = useState('10')
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [creating, setCreating] = useState(false)

  // Filtro
  const [filter, setFilter] = useState<'all' | 'mine' | 'pending' | 'done'>('all')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    // Obtener hogar del usuario
    const { data: membership } = await supabase
      .from('home_members')
      .select('home_id, homes(id, name, invite_code)')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      setLoading(false)
      return
    }

    const homeData = membership.homes as any
    setHome(homeData)

    // Obtener miembros del hogar
    const { data: memberData } = await supabase
      .from('home_members')
      .select('user_id, profiles(id, full_name, username)')
      .eq('home_id', homeData.id)

    setMembers(memberData?.map((m: any) => m.profiles) || [])

    // Obtener tareas
    await loadTasks(homeData.id)
    setLoading(false)
  }

  async function loadTasks(homeId: string) {
    const { data } = await supabase
      .from('tasks')
      .select(`
        id, title, description, points, status, assigned_to, due_date,
        assignee:profiles!tasks_assigned_to_fkey(full_name, username)
      `)
      .eq('home_id', homeId)
      .order('created_at', { ascending: false })

    setTasks((data as any) || [])
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

    const { error } = await supabase.from('tasks').insert({
      home_id: home.id,
      title: newTitle.trim(),
      description: newDesc.trim(),
      points: parseInt(newPoints) || 10,
      assigned_to: assignedTo || null,
      created_by: user?.id,
      status: 'pending'
    })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setShowModal(false)
      setNewTitle('')
      setNewDesc('')
      setNewPoints('10')
      setAssignedTo('')
      await loadTasks(home.id)
    }
    setCreating(false)
  }

  async function completeTask(task: Task) {
    if (task.status === 'completed' || task.status === 'verified') return

    Alert.alert(
      '¿Completaste esta tarea?',
      `Vas a ganar ${task.points} puntos por "${task.title}"`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '¡Sí, la hice! ✅',
          onPress: async () => {
            const { error } = await supabase
              .from('tasks')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', task.id)

            if (!error && home) {
              // Sumar puntos al usuario
              await supabase.rpc('add_points', {
                p_user_id: userId,
                p_home_id: home.id,
                p_task_id: task.id,
                p_points: task.points
              })
              await loadTasks(home.id)
            }
          }
        }
      ]
    )
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'mine') return t.assigned_to === userId
    if (filter === 'pending') return t.status === 'pending'
    if (filter === 'done') return t.status === 'completed' || t.status === 'verified'
    return true
  })

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7fff6e" size="large" />
      </View>
    )
  }

  if (!home) {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>🏠</Text>
        <Text style={styles.emptyTitle}>No estás en ningún hogar</Text>
        <Text style={styles.emptyText}>Cerrá sesión y creá o unite a uno</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>TU HOGAR</Text>
          <Text style={styles.headerTitle}>{home.name}</Text>
        </View>
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>CÓDIGO</Text>
          <Text style={styles.codeValue}>{home.invite_code}</Text>
        </View>
      </View>

      {/* FILTROS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {(['all', 'mine', 'pending', 'done'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Todas' : f === 'mine' ? 'Mis tareas' : f === 'pending' ? 'Pendientes' : 'Hechas'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* LISTA DE TAREAS */}
      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7fff6e" />}
      >
        {filteredTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40 }}>🎉</Text>
            <Text style={styles.emptyTitle}>No hay tareas</Text>
            <Text style={styles.emptyText}>¡Todo limpio por acá!</Text>
          </View>
        )}

        {filteredTasks.map(task => (
          <TouchableOpacity
            key={task.id}
            style={[styles.taskCard, task.status !== 'pending' && styles.taskCardDone]}
            onPress={() => completeTask(task)}
            activeOpacity={0.7}
          >
            <View style={styles.taskLeft}>
              <View style={[
                styles.taskCheck,
                task.status !== 'pending' && styles.taskCheckDone
              ]}>
                {task.status !== 'pending' && <Text style={{ fontSize: 12 }}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.taskTitle,
                  task.status !== 'pending' && styles.taskTitleDone
                ]}>
                  {task.title}
                </Text>
                {task.description ? (
                  <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
                ) : null}
                {task.assignee && (
                  <Text style={styles.taskAssignee}>👤 {task.assignee.full_name || task.assignee.username}</Text>
                )}
              </View>
            </View>
            <View style={styles.taskPoints}>
              <Text style={styles.taskPointsValue}>+{task.points}</Text>
              <Text style={styles.taskPointsLabel}>pts</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* BOTÓN NUEVA TAREA */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabText}>+ Nueva tarea</Text>
      </TouchableOpacity>

      {/* MODAL CREAR TAREA */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nueva tarea</Text>

            <TextInput
              style={styles.input}
              placeholder="Título *"
              placeholderTextColor="#555"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Descripción (opcional)"
              placeholderTextColor="#555"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />

            <Text style={styles.inputLabel}>PUNTOS</Text>
            <View style={styles.pointsRow}>
              {['5', '10', '20', '30', '50'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pointsBtn, newPoints === p && styles.pointsBtnActive]}
                  onPress={() => setNewPoints(p)}
                >
                  <Text style={[styles.pointsBtnText, newPoints === p && styles.pointsBtnTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>ASIGNAR A</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <TouchableOpacity
                style={[styles.memberBtn, assignedTo === '' && styles.memberBtnActive]}
                onPress={() => setAssignedTo('')}
              >
                <Text style={styles.memberBtnText}>Nadie</Text>
              </TouchableOpacity>
              {members.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.memberBtn, assignedTo === m.id && styles.memberBtnActive]}
                  onPress={() => setAssignedTo(m.id)}
                >
                  <Text style={styles.memberBtnText}>{m.full_name || m.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.btn, creating && styles.btnDisabled]}
              onPress={createTask}
              disabled={creating}
            >
              <Text style={styles.btnText}>{creating ? 'Creando...' : 'Crear tarea'}</Text>
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
  codeBox: {
    backgroundColor: '#18181f', borderWidth: 1, borderColor: '#2a2a35',
    borderRadius: 8, padding: 10, alignItems: 'center'
  },
  codeLabel: { fontSize: 9, color: '#444', letterSpacing: 0.12 },
  codeValue: { fontSize: 16, fontWeight: '800', color: '#7fff6e', letterSpacing: 3 },
  filterRow: { paddingHorizontal: 20, paddingVertical: 14, flexGrow: 0 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#2a2a35', marginRight: 8
  },
  filterBtnActive: { backgroundColor: '#7fff6e', borderColor: '#7fff6e' },
  filterText: { fontSize: 12, color: '#666', fontWeight: '600' },
  filterTextActive: { color: '#0f0f14' },
  list: { flex: 1, paddingHorizontal: 20 },
  taskCard: {
    backgroundColor: '#18181f', borderRadius: 10, padding: 16,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a35'
  },
  taskCardDone: { opacity: 0.5 },
  taskLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#3a3a4a',
    justifyContent: 'center', alignItems: 'center'
  },
  taskCheckDone: { backgroundColor: '#7fff6e', borderColor: '#7fff6e' },
  taskTitle: { fontSize: 14, fontWeight: '700', color: '#f0f0f5', marginBottom: 2 },
  taskTitleDone: { textDecorationLine: 'line-through', color: '#555' },
  taskDesc: { fontSize: 12, color: '#555', marginBottom: 2 },
  taskAssignee: { fontSize: 11, color: '#444' },
  taskPoints: { alignItems: 'center', marginLeft: 12 },
  taskPointsValue: { fontSize: 16, fontWeight: '900', color: '#7fff6e' },
  taskPointsLabel: { fontSize: 9, color: '#444', letterSpacing: 0.1 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#f0f0f5' },
  emptyText: { fontSize: 13, color: '#555' },
  fab: {
    position: 'absolute', bottom: 80, right: 24, left: 24,
    backgroundColor: '#7fff6e', borderRadius: 12,
    padding: 16, alignItems: 'center'
  },
  fabText: { color: '#0f0f14', fontWeight: '800', fontSize: 15 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#111118', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 28,
    borderWidth: 1, borderColor: '#1a1a24'
  },
  modalTitle: {
    fontSize: 20, fontWeight: '900', color: '#f0f0f5',
    marginBottom: 20, letterSpacing: -0.5
  },
  input: {
    backgroundColor: '#18181f', color: '#f0f0f5',
    borderWidth: 1, borderColor: '#2a2a35',
    borderRadius: 8, padding: 14, fontSize: 14, marginBottom: 14
  },
  inputLabel: {
    fontSize: 10, color: '#444', letterSpacing: 0.12,
    marginBottom: 8
  },
  pointsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pointsBtn: {
    flex: 1, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#2a2a35', alignItems: 'center'
  },
  pointsBtnActive: { backgroundColor: '#7fff6e', borderColor: '#7fff6e' },
  pointsBtnText: { fontSize: 13, fontWeight: '700', color: '#666' },
  pointsBtnTextActive: { color: '#0f0f14' },
  memberBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#2a2a35', marginRight: 8
  },
  memberBtnActive: { backgroundColor: '#18181f', borderColor: '#7fff6e' },
  memberBtnText: { fontSize: 12, color: '#888', fontWeight: '600' },
  btn: {
    backgroundColor: '#7fff6e', borderRadius: 8,
    padding: 16, alignItems: 'center', marginBottom: 10
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#0f0f14', fontWeight: '800', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelText: { color: '#555', fontSize: 13 }
})