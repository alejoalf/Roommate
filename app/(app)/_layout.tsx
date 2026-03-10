import { Tabs, Slot } from 'expo-router'
import { Animated, Text, View, StyleSheet, TouchableOpacity, useWindowDimensions, Image } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { useRef, useEffect } from 'react'

function AnimatedTabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.25 : 1,
      useNativeDriver: true,
      damping: 10,
      stiffness: 180
    }).start()
  }, [focused])

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
    </Animated.View>
  )
}

function DesktopSidebar() {
  const router = useRouter()
  const pathname = usePathname()

  const tabs = [
    { name: 'index', path: '/(app)/', label: 'Tareas', icon: '✅' },
    { name: 'ranking', path: '/(app)/ranking', label: 'Ranking', icon: '🏆' },
    { name: 'rewards', path: '/(app)/rewards', label: 'Premios', icon: '🎁' },
    { name: 'profile', path: '/(app)/profile', label: 'Perfil', icon: '👤' },
  ]

  return (
    <View style={styles.desktopContainer}>
      <View style={styles.sidebar}>
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
        </View>
        
        {tabs.map(tab => {
          const isActive = pathname === tab.path || 
            (tab.name === 'index' && pathname === '/(app)')
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
              onPress={() => router.push(tab.path as any)}
            >
              <Text style={styles.sidebarIcon}>{tab.icon}</Text>
              <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={styles.mainContent}>
        <Slot />
      </View>
    </View>
  )
}

function MobileTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#1c1712',
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTitle: () => (
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.mobileHeaderLogo} 
            resizeMode="contain" 
          />
        ),
        headerTitleAlign: 'center',
        tabBarStyle: {
          backgroundColor: '#1c1712',
          borderTopColor: 'rgba(212,165,116,0.12)',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64
        },
        tabBarActiveTintColor: '#e67e50',
        tabBarInactiveTintColor: '#5a4a40',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tareas',
          tabBarIcon: ({ focused }) => <AnimatedTabIcon emoji="✅" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ focused }) => <AnimatedTabIcon emoji="🏆" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Premios',
          tabBarIcon: ({ focused }) => <AnimatedTabIcon emoji="🎁" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <AnimatedTabIcon emoji="👤" focused={focused} />
        }}
      />
    </Tabs>
  )
}

export default function AppLayout() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 900

  if (isDesktop) {
    return <DesktopSidebar />
  }

  return <MobileTabs />
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0a0a0f',
  },
  sidebar: {
    width: 240,
    backgroundColor: '#111118',
    borderRightWidth: 1,
    borderRightColor: '#1a1a24',
    paddingTop: 32,
    paddingHorizontal: 16,
  },
  logoWrap: {
    alignItems: 'flex-start',
    marginBottom: 40,
    paddingHorizontal: 12,
  },
  logoImage: {
    width: 120,
    height: 44,
  },
  mobileHeaderLogo: {
    width: 100,
    height: 36,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(230, 126, 80, 0.15)',
  },
  sidebarIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  sidebarLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5a4a40',
  },
  sidebarLabelActive: {
    color: '#e67e50',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#0f0f14',
  },
})