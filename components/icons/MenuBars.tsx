import { View } from "react-native";

export default function MenuBars() {
    return (
        <View className='flex-1 flex-row'>
            <View className="space-y-2">
                <View className="h-1 rounded-full w-4 bg-white"></View>
                <View className="h-1 rounded-full w-8 bg-white"></View>
                <View className="h-1 rounded-full w-6 bg-gray-50"></View>
            </View>
        </View>
    )
}