import { View, Text, SafeAreaView, TouchableOpacity, Image } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const OnBoarding = () => {
    const setOnBoarding = async () => {
        try {
            await AsyncStorage.setItem('firstOpening', 'true')
        } catch (e) {
            // saving error
        }
    }
    return (
        <SafeAreaView className="flex-1 bg-blue-500 items-center justify-end p-6">
            <TouchableOpacity 
                onPress={() => setOnBoarding()}
                className="bg-white rounded-lg py-5 w-full"
            >
                <Text className="text-center text-base">Get started</Text>
            </TouchableOpacity>
        </SafeAreaView>
    )
}
export default OnBoarding