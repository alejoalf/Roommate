import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>✅</Text>
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: 'Ranking',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏆</Text>
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Premios',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🎁</Text>
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text>
        }}
      />
    </Tabs>
  )
}