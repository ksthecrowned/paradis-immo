import { cardShadow } from "@/constants/shadows"
import { Ionicons } from "@expo/vector-icons"
import { Image, Text, View } from "react-native"
import Animated, { BounceIn } from "react-native-reanimated"

const PropertyPrimaryCard = () => {
  return (
    <Animated.View 
      entering={BounceIn.delay(0).duration(100)}
      className='rounded-2xl bg-white overflow-hidden p-2' 
      style={cardShadow}
    >
      <View className='rounded-xl overflow-hidden w-full h-[190px]'>
        <Image
          source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
          className='object-cover w-full h-full'
        />
      </View>
      <View className='gap-1 mt-0.5 px-2 pb-2'>
        <Text 
          className='text-xl font-medium' 
          numberOfLines={1}
        >
          Splendide appartement
        </Text>
        <View className='flex-row items-center space-x-1 mt-0.5'>
          <Ionicons name='location-outline' color={"#3b82f6"} size={20} />
          <Text className='text-gray-600' numberOfLines={1}>Moungali, Brazzaville Congo...</Text>
        </View>
        <View className="flex-row items-center space-x-4 mt-1 -ml-1">
          <View className='flex-row items-center space-x-1'>
            <Ionicons name='bed-outline' size={20} />
            <Text className=''>2</Text>
          </View>
          <View className='flex-row items-center space-x-1'>
            <Ionicons name='car-outline' size={20} />
            <Text className=''>1</Text>
          </View>
          <View className='flex-row items-center space-x-1'>
            <Ionicons name='share-outline' size={20} />
            <Text className=''>1</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  )
}
export default PropertyPrimaryCard