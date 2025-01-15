import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { cardShadow } from '@/constants/shadows'


const {height: SCREEN_HEIGHT } = Dimensions.get('window')
const MAX_TRANSLATE_Y = SCREEN_HEIGHT / 1.5
const MIN_TRANSLATE_Y = SCREEN_HEIGHT / 5

export default function Bottomsheet({ children }: { children: React.ReactNode }) {
    const [shouldHide, setShouldHide] = useState(true)
    const translateY = useSharedValue(SCREEN_HEIGHT)
    const context = useSharedValue({y: 0})

    const gesture = Gesture.Pan()
    .onStart(e => {
        context.value = {y: translateY.value}
    })
    .onUpdate(e => {
        translateY.value = e.translationY + context.value.y;
        translateY.value = Math.max(translateY.value, -MAX_TRANSLATE_Y)
    })
    .onEnd(e => {
        if(translateY.value > -MIN_TRANSLATE_Y){
            translateY.value = withSpring(SCREEN_HEIGHT)
        }
        if(translateY.value < -MIN_TRANSLATE_Y){
            translateY.value = withSpring(-MAX_TRANSLATE_Y)
        }
    })

    /**
     * Animated style for the bottom sheet
     */
    const reanimatedBottomStyle = useAnimatedStyle( () => {
        return {
            transform: [ {translateY: translateY.value} ]
        }
    })
    
    /**
     * Scrolls to a specific destination
     * @param {number} destination - The destination to scroll to
     */
    const scrollTo = ( destination: number ) => {
        'worklet'
        translateY.value = withSpring(destination, {damping: 50})
    }
      
  return (
    <Animated.View style={[styles.bottomsheet_container, reanimatedBottomStyle, {display: shouldHide ? 'none' : 'flex'}, cardShadow]}>
        <GestureDetector gesture={gesture}>
            <View className='items-center justify-center py-3'>
                <TouchableOpacity className='w-20 h-2 bg-blue-900 rounded-full' />
            </View>
        </GestureDetector>
        {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
    bottomsheet_container: {
        width: '100%',
        height: SCREEN_HEIGHT,
        backgroundColor: "#fff",
        overflow: 'hidden',
        position: 'absolute',
        top: (SCREEN_HEIGHT + 160) / 1.5,
        zIndex: 12000,
        borderRadius: 25,
        paddingHorizontal: 10
    }
})
