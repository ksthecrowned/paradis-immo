import { Text, View, TouchableOpacity, StyleSheet } from 'react-native'
import { useRef, useEffect } from 'react'
import * as Animatable from 'react-native-animatable'
import React from 'react'

const animate1 = {0: {scale: .5, translateY: 8}, 0.92: {translateY: -34}, 1: {scale: 1.2, translateY: -24}}
const animate2 = {0: {scale: 1.2, translateY: -24}, 1: {scale: 1, translateY: 8}}

const circleanim1 = {0: {scale: 0}, 0.3: {scale: .9}, 0.5: {scale: .2}, 0.8: {scale: .7}, 1: {scale: 1}}
const circleanim2 = {0: {scale: 1}, 1: {scale: 0}}

const TabButton = (props: any) => {
    const { icon, label, onPress, accessibilityState } = props
    const focused = accessibilityState.selected
    const viewRef = useRef<any>(null)
    const circleRef = useRef<any>(null)
    const textRef = useRef<any>(null)

    useEffect(() => {
        if(focused) {
            viewRef.current?.animate(animate1)
            circleRef.current?.animate(circleanim1)
            textRef.current?.transitionTo({scale: 1})
        } else {
            viewRef.current?.animate(animate2)
            circleRef.current?.animate(circleanim2)
            textRef.current?.transitionTo({scale: 0})
        }
    }, [focused])

    return (
        <TouchableOpacity className="flex-1 justify-center items-center"
            onPress={onPress}
            activeOpacity={1}
        >
            <Animatable.View
                ref={viewRef}
                duration={800}
                className="flex-1 justify-center items-center"
            >
                {label == "Notifications" 
                    && <View className={"absolute z-50 items-center justify-center top-2 h-4 w-4 rounded-full bg-red-600 " + (focused ? "left-6" : "left-7")}>
                        <Text className="text-white" style={{fontSize:10}}>3</Text>
                    </View>
                }
                <View className="h-12 w-12 rounded-full border-2 border-white bg-white justify-center items-center">
                    <Animatable.View 
                        ref={circleRef}
                        style={{...StyleSheet.absoluteFillObject}} className="bg-blue-500 rounded-full" 
                    />
                    {focused ? icon[1] : icon[0]}
                </View> 
                <Animatable.Text
                    ref={textRef}
                    className="text-blue-500 text-center" style={{fontSize:10}}
                >
                    {label}
                </Animatable.Text>
            </Animatable.View>
        </TouchableOpacity>
    )
}
export default TabButton