import { View, Image, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'

// Import assets
import backArrow from '../../assets/icons/back-arrow.png'

const BackButton = () => {
    const navigation = useNavigation()
    
    return (
        <>
            <View className="absolute w-full pt-12 pb-3 justify-between top-0 z-50 px-5 overflow-hidden">
                {/* Paths... */}
                <View className="h-72 w-72 rounded-full absolute -top-44 -left-36 bg-blue-400 opacity-30"></View>

                <View className="">
                    <TouchableOpacity className="rounded-md w-10 h-10 px-1.5 bg-gray-100/20 items-center justify-center border border-white" onPress={() => navigation.goBack()}>
                        <Image source={backArrow} className="h-7 w-7"></Image>
                    </TouchableOpacity>
                </View>
            </View>
        </>
    )
}

export default BackButton