import Animated from "react-native-reanimated"
import { TouchableOpacity } from "react-native-gesture-handler"
import { View, Text, Image } from "react-native"
import { useRouter } from "expo-router"
import { cardShadow } from "@/constants/shadows"

const PropertiesCategoryCard = () => {
  const router = useRouter()
  return (
    <Animated.View
      className='w-full p-2'
    >
      <TouchableOpacity 
        onPress={() => router.push('/categories/1')}
        className="h-44 w-full items-center justify-center bg-white rounded-2xl p-4" 
        style={cardShadow}
      >
        <Image 
          source={require('@/assets/images/buildingIcon.png')} 
          className="h-28 w-24 mb-2 object-cover" 
        />
        <Text className="font-bold uppercase">Bureaux</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

export default PropertiesCategoryCard