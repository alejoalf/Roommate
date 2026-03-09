import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Cómo se muestran las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// Pedir permisos y obtener el token del dispositivo
export async function registerForPushNotifications(): Promise<string | null> {
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
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null
  })
}

// Programar recordatorio para una tarea
export async function scheduleTaskReminder(
  taskTitle: string,
  dueDate: Date,
  taskId: string
) {
  const reminderDate = new Date(dueDate.getTime() - 2 * 60 * 60 * 1000)
  if (reminderDate < new Date()) return

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
}

// Cancelar todos los recordatorios
export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync()
}