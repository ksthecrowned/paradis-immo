import { cardShadow } from "@/constants/shadows"
import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { TouchableOpacity } from "react-native"
import { View, Text, Image } from "react-native"
import Animated, { BounceIn } from "react-native-reanimated"

const PropertySecondaryCard = () => {
  return (
    <Animated.View
      entering={BounceIn.delay(0).duration(100)}
    >
      <TouchableOpacity 
        onPress={() => router.push('/(tabs)')}
        className='flex-row rounded-2xl overflow-hidden bg-white'
        style={cardShadow}
      >
        <View className='w-32 h-32 relative overflow-hidden'>
          <Image
            source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
            className='object-cover w-32 h-32'
          />
          <View className="absolute h-full w-full bg-black/10"></View>
        </View>
        <View className='flex-1 p-4 gap-0.5'>
          <Text className='text-base font-medium text-blue-500' numberOfLines={1}>Splendide appartement</Text>
          <Text className='text-sm' numberOfLines={1}>Diata, Brazzaville Congo</Text>
          <Text className='text-sm' numberOfLines={1}>VIC 3473</Text>
          <View className="flex-row items-center space-x-4 mt-1 -ml-1">
            <View className='flex-row items-center space-x-1'>
              <Ionicons name='bed-outline' size={17} />
              <Text className='text-sm font-medium'>2</Text>
            </View>
            <View className='flex-row items-center space-x-1'>
              <Ionicons name='car-outline' size={17} />
              <Text className='text-sm font-medium'>1</Text>
            </View>
            <View className='flex-row items-center space-x-1'>
              <Ionicons name='share-outline' size={17} />
              <Text className='text-sm font-medium'>1</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

export default PropertySecondaryCard