import ParadisPatterns from "../common/ParadisPatterns"
import { Link, router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import MenuBars from "../icons/MenuBars"
import { View } from "react-native-animatable"
import { Image, StatusBar, Text } from "react-native" 
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle,
    useDerivedValue,
    withSpring,
} from "react-native-reanimated"
import ParadisRoundedPath from "../common/ParadisRoundedPath"
import { TouchableOpacity } from "react-native-gesture-handler"

const PrimaryHeader = (
    { 
        scrollY, 
        children, 
        title,
        smallHeader
    }
    : { 
        scrollY: SharedValue<number>, 
        children: React.ReactNode, 
        title: string,
        smallHeader?: boolean
    }
) => {
    const smoothScrollY = useDerivedValue(() => {
        return withSpring(scrollY.value, { damping: 20, stiffness: 90 });
    });

    const animatedStyle = useAnimatedStyle(() => {
        const heightValue = smallHeader ? 200 : 320
        const paddingTopValue = smallHeader ? 0 : 56
        const opacityInputRange = smallHeader ? [0, 200] : [0, 250];

        const translateY = interpolate(smoothScrollY.value, 
            [0, heightValue], // inputRange
            [0, -heightValue], // outputRange
            Extrapolation.CLAMP // extrapolate
        );
        
        const headerHeight = interpolate(smoothScrollY.value, [0, heightValue], [heightValue, 0], Extrapolation.CLAMP);

        const paddingTop = interpolate(smoothScrollY.value, [0, heightValue], [paddingTopValue, 0], Extrapolation.CLAMP);

        const opacity = interpolate(smoothScrollY.value, opacityInputRange, [1, 0], Extrapolation.CLAMP);
        
        return {
            transform: [{ translateY }],
            height: headerHeight,
            paddingTop,
            opacity
        };
    });

    const animatedTitleStyle = useAnimatedStyle(() => {
        const opacity = interpolate(smoothScrollY.value, [0, 250], [0, 1], Extrapolation.CLAMP);
        return {
            opacity
        }
    })
    return (    
        <Animated.View className={"h-fit bg-transparent"}>
            <StatusBar barStyle={'default'} />
            <Animated.View className="bg-blue-500 relative overflow-hidden pb-5 py-10">
                <ParadisPatterns />
                <Animated.View 
                    style={[animatedStyle, { backgroundColor: 'transparent' }]}
                    className="px-4 items-center justify-center"
                >
                    {children}
                </Animated.View>
                <View className="px-4 mb-2">
                    <View className='flex-row items-center justify-between space-x-4'>
                        <Animated.View 
                            style={animatedTitleStyle} 
                            className="flex-row items-center space-x-2"
                        >
                            <Image 
                                className='h-12 w-12' 
                                source={require('@/assets/logos/paradis-logo.png')} 
                            />
                            <Text className="text-white text-2xl font-bold">{title}</Text>
                        </Animated.View>
                        <View className='flex-row items-center space-x-4'>
                            <TouchableOpacity
                                onPress={() => router.push('/search')}
                            >
                                <Ionicons name='search' color={"#FFF"} size={26} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => router.push('/notifications')}
                            >
                                <Ionicons name='notifications' color={"#FFF"} size={26} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Animated.View>
            <View className="transform rotate-180">
                <ParadisRoundedPath fill="white" height={35} />
            </View>
        </Animated.View>
    )
}

export default PrimaryHeader