import { useEffect, useRef } from 'react'
import {
  Animated, View, Text, StyleSheet, ViewStyle
} from 'react-native'

// ─── FADE + SLIDE UP al montar ───────────────────────────────
export function FadeInView({
  children, delay = 0, style
}: { children: React.ReactNode; delay?: number; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 350, delay,
        useNativeDriver: true
      }),
      Animated.spring(translateY, {
        toValue: 0, delay, useNativeDriver: true,
        damping: 18, stiffness: 120
      })
    ]).start()
  }, [])

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  )
}

// ─── SCALE BOUNCE al montar ──────────────────────────────────
export function ScaleInView({
  children, delay = 0, style
}: { children: React.ReactNode; delay?: number; style?: ViewStyle }) {
  const scale = useRef(new Animated.Value(0.85)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, delay, useNativeDriver: true }),
      Animated.spring(scale, {
        toValue: 1, delay, useNativeDriver: true,
        damping: 14, stiffness: 180
      })
    ]).start()
  }, [])

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  )
}

// ─── PUNTOS FLOTANDO al completar tarea ──────────────────────
export function FloatingPoints({
  points, visible, onDone
}: { points: number; visible: boolean; onDone: () => void }) {
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.5)).current

  useEffect(() => {
    if (!visible) return
    translateY.setValue(0)
    opacity.setValue(0)
    scale.setValue(0.5)

    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.2, useNativeDriver: true, damping: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 700, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true })
        ])
      ])
    ]).start(onDone)
  }, [visible])

  if (!visible) return null

  return (
    <Animated.View style={[
      floatStyles.wrap,
      { opacity, transform: [{ translateY }, { scale }] }
    ]}>
      <Text style={floatStyles.text}>+{points} pts ⭐</Text>
    </Animated.View>
  )
}

const floatStyles = StyleSheet.create({
  wrap: {
    position: 'absolute', alignSelf: 'center',
    top: '40%', zIndex: 999,
    backgroundColor: '#e67e50',
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 30, shadowColor: '#e67e50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 10
  },
  text: { color: '#fff', fontSize: 18, fontWeight: '900' }
})

// ─── SKELETON LOADER ─────────────────────────────────────────
export function SkeletonCard({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return <Animated.View style={[skeletonStyles.card, style, { opacity }]} />
}

export function SkeletonScreen() {
  return (
    <View style={skeletonStyles.container}>
      <SkeletonCard style={{ height: 28, width: '40%', borderRadius: 6, marginBottom: 6 }} />
      <SkeletonCard style={{ height: 16, width: '60%', borderRadius: 4, marginBottom: 32 }} />
      <SkeletonCard style={{ height: 120, borderRadius: 14, marginBottom: 12 }} />
      <SkeletonCard style={{ height: 80, borderRadius: 14, marginBottom: 12 }} />
      <SkeletonCard style={{ height: 80, borderRadius: 14, marginBottom: 12 }} />
      <SkeletonCard style={{ height: 80, borderRadius: 14 }} />
    </View>
  )
}

const skeletonStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#110e0a', padding: 20, paddingTop: 80 },
  card: { backgroundColor: '#2e2820', width: '100%' }
})

// ─── PRESS SCALE — botones que se achican al tocar ───────────
export function PressScale({
  children, onPress, style
}: { children: React.ReactNode; onPress: () => void; style?: ViewStyle }) {
  const scale = useRef(new Animated.Value(1)).current

  const pressIn = () => Animated.spring(scale, {
    toValue: 0.95, useNativeDriver: true, damping: 15
  }).start()

  const pressOut = () => Animated.spring(scale, {
    toValue: 1, useNativeDriver: true, damping: 12
  }).start()

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <View
        onStartShouldSetResponder={() => true}
        onResponderGrant={pressIn}
        onResponderRelease={() => { pressOut(); onPress() }}
        onResponderTerminate={pressOut}
      >
        {children}
      </View>
    </Animated.View>
  )
}