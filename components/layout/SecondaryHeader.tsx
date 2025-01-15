import ParadisPatterns from "../common/ParadisPatterns"
import { Ionicons } from "@expo/vector-icons"
import { View } from "react-native-animatable"
import { StatusBar, Text, TouchableOpacity } from "react-native" 
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle, useDerivedValue, withSpring } from "react-native-reanimated"
import { router } from "expo-router"

const SecondaryHeader = (
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
    <>
      <StatusBar barStyle={'default'} />
      <Animated.View className="bg-blue-500 relative overflow-hidden pt-10 pb-4 rounded-b-3xl">
        <View className="px-4">
          <ParadisPatterns />
          <Animated.View 
              style={[animatedStyle, { backgroundColor: 'transparent' }]}
              className="px-4 items-center justify-center"
          >
              {children}
          </Animated.View>
          <Animated.View style={[animatedTitleStyle]} className='flex-row items-center space-x-4'>
            <TouchableOpacity
              onPress={() => {router.back()}}
            >
              <Ionicons name='arrow-back' color={"#FFF"} size={30} />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-white" numberOfLines={1}>{title}</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </>
  )
}

export default SecondaryHeader