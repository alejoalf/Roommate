import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111118',
          borderTopColor: '#1a1a24',
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: '#7fff6e',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tareas',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Hogar',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />
    </Tabs>
  )
}
