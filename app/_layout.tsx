import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { View, ActivityIndicator } from 'react-native'
import { registerForPushNotifications, savePushToken } from '../lib/notifications'
import * as Notifications from 'expo-notifications'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
      })
      .catch((error) => {
        console.log('Error obteniendo sesión:', error)
      })
      .finally(() => {
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    registerForPushNotifications()
      .then(token => {
        if (token) savePushToken(token)
      })
      .catch(error => {
        console.log('Error registrando notificaciones:', error)
      })

    const sub = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notificación recibida:', notification)
    })

    const subResponse = Notifications.addNotificationResponseReceivedListener(response => {
      const taskId = response.notification.request.content.data?.taskId
      if (taskId) {
        console.log('Tap en notificación, taskId:', taskId)
      }
    })

    return () => {
      sub.remove()
      subResponse.remove()
    }
  }, [session])

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inAppGroup = segments[0] === '(app)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && !inAppGroup) {
      router.replace('/(app)/')
    }
  }, [session, loading, segments])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f14' }}>
        <ActivityIndicator color="#7fff6e" />
      </View>
    )
  }

  return <Slot />
}