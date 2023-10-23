import { View, Text, TouchableOpacity, useWindowDimensions, Animated } from 'react-native'
import { useRef, useEffect } from 'react'
import Svg, { G, Circle } from 'react-native-svg'
import { AntDesign } from '@expo/vector-icons'

const OnBoardingNextBtn = ({ scrollTo, percentage }) => {
    const size = 128
    const strokeWidth = 2
    const center = size / 2
    const radius = size / 2 - strokeWidth / 2
    const circumference = 2 * Math.PI * radius

    const progressAnimation = useRef(new Animated.Value(0)).current
    const progressRef = useRef(null)
    const animation = (toValue) => {
        return Animated.timing(progressAnimation, {
            toValue,
            duration: 250,
            useNativeDriver: true
        }).start()
    }

    useEffect(() => {
        animation(percentage)
    }, [percentage])

    useEffect(() => {
        progressAnimation.addListener(
            (value) => {
                const strokeDashoffset = circumference - (circumference * value.value) / 100

                if(progressRef?.current) {
                    progressRef.current.setNativeProps({
                        strokeDashoffset
                    })
                }
            }, 
            [percentage]
        )

        return () => {
            progressAnimation.removeAllListeners()
        }
    }, [])

    return (
        <View className="flex-1 justify-center items-center">
            <Svg width={size} height={size}>
                <Circle 
                    stroke="#E6E7E8" cx={center} cy={center} r={radius} strokeWidth={strokeWidth}
                />
                <Circle 
                    ref={progressRef}
                    stroke="#F4338F" 
                    cx={center} 
                    cy={center} 
                    r={radius} 
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                />
            </Svg>
            <TouchableOpacity onPress={scrollTo} activeOpacity={0.6} className="absolute bg-red-600 p-5 rounded-full">
                <AntDesign name="arrowright" size={32} color="#fff" />
            </TouchableOpacity>
        </View>
    )
}

export default OnBoardingNextBtn