import { View, useWindowDimensions, Animated } from 'react-native'

const OnBoardingPaginator = ({ data, scrollX }) => {
    const { width } = useWindowDimensions()
    return (
        <View className="flex-row gap-6 absolute bottom-8">
            {
                data.map((_, i) => {
                    const inputRange = [(i - 1) * width, i * width, (i + 1) * width]
                    const dotWidth = scrollX.interpolate({
                        inputRange,
                        outputRange: [12, 36, 12],
                        extrapolate: 'clamp',
                    })
                    const opacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.3, 1, 0.3],
                        extrapolate: 'clamp',
                    })
                    return <Animated.View className="h-3 rounded-full bg-gray-600" style={{ width: dotWidth, opacity }} key={i} />
                })
            }
        </View>
    )
}

export default OnBoardingPaginator