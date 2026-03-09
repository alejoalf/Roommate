import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

const isWeb = Platform.OS === 'web'
const canScheduleNotifications =
  typeof Notifications.scheduleNotificationAsync === 'function'
const canCancelNotifications =
  typeof Notifications.cancelAllScheduledNotificationsAsync === 'function'

// Cómo se muestran las notificaciones cuando la app está abierta
if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

// Pedir permisos y obtener el token del dispositivo
export async function registerForPushNotifications(): Promise<string | null> {
  if (isWeb) {
    return null
  }

  if (!Device.isDevice) {
    console.log('Las notificaciones solo funcionan en dispositivo físico')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Permiso de notificaciones denegado')
    return null
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined
    })).data
    return token
  } catch (error) {
    console.log('Error obteniendo token:', error)
    return null
  }
}

// Guardar el token en Supabase para poder enviar notificaciones después
export async function savePushToken(token: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles')
    .update({ push_token: token })
    .eq('id', user.id)
}

// Notificación local inmediata
export async function sendLocalNotification(title: string, body: string) {
  if (isWeb || !canScheduleNotifications) return

  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null
    })
  } catch (error) {
    console.log('No se pudo enviar notificación local:', error)
  }
}

// Programar recordatorio para una tarea
export async function scheduleTaskReminder(
  taskTitle: string,
  dueDate: Date,
  taskId: string
) {
  if (isWeb || !canScheduleNotifications) return

  const reminderDate = new Date(dueDate.getTime() - 2 * 60 * 60 * 1000)
  if (reminderDate < new Date()) return

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Tarea por vencer',
        body: `"${taskTitle}" vence en 2 horas. ¡No olvides completarla!`,
        data: { taskId },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      }
    })
  } catch (error) {
    console.log('No se pudo programar recordatorio:', error)
  }
}

// Cancelar todos los recordatorios
export async function cancelAllReminders() {
  if (isWeb || !canCancelNotifications) return

  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
  } catch (error) {
    console.log('No se pudieron cancelar recordatorios:', error)
  }
}