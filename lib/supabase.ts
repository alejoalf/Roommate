import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
export const SUPABASE_STORAGE_KEY = `sb-${projectRef}-auth-token`

const webStorage = {
  getItem: (key: string) => Promise.resolve(globalThis.localStorage.getItem(key)),
  setItem: (key: string, value: string) => {
    globalThis.localStorage.setItem(key, value)
    return Promise.resolve()
  },
  removeItem: (key: string) => {
    globalThis.localStorage.removeItem(key)
    return Promise.resolve()
  },
}

const authStorage = Platform.OS === 'web' ? webStorage : AsyncStorage

export async function clearPersistedAuthSession() {
  const keys = [
    SUPABASE_STORAGE_KEY,
    `${SUPABASE_STORAGE_KEY}-code-verifier`,
    `${SUPABASE_STORAGE_KEY}-user`,
  ]

  if (Platform.OS === 'web') {
    for (const key of keys) {
      globalThis.localStorage.removeItem(key)
      globalThis.sessionStorage.removeItem(key)
    }
    return
  }

  await AsyncStorage.multiRemove(keys)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    storageKey: SUPABASE_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})