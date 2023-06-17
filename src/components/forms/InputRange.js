import { View, Text, Dimensions, TextInput } from 'react-native'
import React from 'react'
import Animated, { useAnimatedStyle, useAnimatedGestureHandler, useSharedValue, useAnimatedProps, runOnJS } from "react-native-reanimated"
import { PanGestureHandler } from 'react-native-gesture-handler'

const WIDTH = Dimensions.get('window').width - 40
const MAXWIDTH = WIDTH - 20/2 + 6

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

const InputRange = ({ min, max, title, steps, onValueChange }) => {

    const xKnob1 = useSharedValue(0)
    const scaleKnob1 = useSharedValue(1)
    const xKnob2 = useSharedValue(MAXWIDTH)
    const scaleKnob2 = useSharedValue(1)

    const gestureHandler1 = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.startX = xKnob1.value
        },
        onActive: (event, ctx) => {
            scaleKnob1.value = 1.3
            xKnob1.value = 
                ctx.startX + event.translationX < 0 
                    ? 0 
                    : ctx.startX + event.translationX > xKnob2.value 
                    ? xKnob2.value 
                    : ctx.startX + event.translationX
        },
        onEnd: () => {
            scaleKnob1.value = 1
            runOnJS(onValueChange)({
                min: `${Math.round((min + (xKnob1.value / MAXWIDTH) * (max - min)) / steps) * steps}`,
                max: `${Math.round((min + (xKnob2.value / MAXWIDTH) * (max - min)) / steps) * steps}`
            })
        }
    })
    const styleKnob1 = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateX: xKnob1.value,
                },
                {
                    scale: scaleKnob1.value,
                }
            ]
        }
    })

    const gestureHandler2 = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.startX = xKnob2.value
        },
        onActive: (event, ctx) => {
            scaleKnob2.value = 1.3
            xKnob2.value = 
                ctx.startX + event.translationX < xKnob1.value 
                    ? xKnob1.value 
                    : ctx.startX + event.translationX > MAXWIDTH 
                    ? MAXWIDTH 
                    : ctx.startX + event.translationX
        },
        onEnd: () => {
            scaleKnob2.value = 1
            runOnJS(onValueChange)({
                min: `${Math.round((min + (xKnob1.value / MAXWIDTH) * (max - min)) / steps) * steps}`,
                max: `${Math.round((min + (xKnob2.value / MAXWIDTH) * (max - min)) / steps) * steps}`
            })
        }
    })
    const styleKnob2 = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateX: xKnob2.value,
                },
                {
                    scale: scaleKnob2.value,
                }
            ]
        }
    })

    const styleLine = useAnimatedStyle(() => {
        return {
            backgroundColor: 'rgb(59, 130, 246)',
            height: 4,
            marginTop: -4,
            borderRadius: 4,
            width: xKnob2.value - xKnob1.value,
            transform: [{ translateX: xKnob1.value }]
        }
    })

    const propsLabel1 = useAnimatedProps(() => {
        return {
            text: `${(Math.round((min + (xKnob1.value / MAXWIDTH) * (max - min)) / steps) * steps).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')}`
        }
    })

    const propsLabel2 = useAnimatedProps(() => {
        return {
            text: `${(Math.round((min + (xKnob2.value / MAXWIDTH) * (max - min)) / steps) * steps).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')}`
        }
    })

    return (
        <View className="">
            <View className="mb-3">
                <Text className="text-lg text-gray-800">{title}</Text>
            </View>
            <View className="flex-row justify-between mb-4">
                <AnimatedTextInput 
                    defaultValue={'0'} 
                    editable={false}
                    animatedProps={propsLabel1}
                />
                <AnimatedTextInput 
                    defaultValue={'0'} 
                    editable={false}
                    animatedProps={propsLabel2}
                />
            </View>
            <View className="h-1 bg-blue-200 rounded-full"></View>
            <Animated.View style={styleLine} />
            <View>
                <PanGestureHandler onGestureEvent={gestureHandler1}>
                    <Animated.View style={[styleKnob1]} className="absolute h-5 w-5 rounded-full border-2 border-blue-400 bg-white -top-3" />
                </PanGestureHandler>
                <PanGestureHandler onGestureEvent={gestureHandler2}>
                    <Animated.View style={[styleKnob2]} className="absolute h-5 w-5 rounded-full border-2 border-blue-400 bg-white -top-3" />
                </PanGestureHandler>
            </View>
        </View>
    )
}

export default InputRange