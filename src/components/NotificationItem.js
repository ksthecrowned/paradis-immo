import { View, Text, TouchableOpacity } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

const NotificationItem = ({ notification }) => {
    return (
        <TouchableOpacity className="flex-row items-center space-x-2 bg-gray-100 p-3">
            <View className="relative items-center justify-center w-12 h-12">
                <View className={`absolute w-12 h-12 rounded-full bg-green-500/30 border border-green-500/10`}></View>
                <View className={`absolute h-6 w-6 rounded-full bg-green-500 justify-center items-center animate-ping`}>
                    <MaterialCommunityIcons name="check" color="#fff" size={20} />
                </View>
            </View>
            <View className="space-y-2">
                <Text className="pr-8">{notification.text}</Text>
                <Text className="text-xs">{notification.dateTime}</Text>
            </View>
        </TouchableOpacity>
    )
}

export default NotificationItem