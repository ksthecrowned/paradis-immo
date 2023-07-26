import { View, Text } from 'react-native'

const NestedPageTitle = ({ title, description }) => {
    return (
        <View className="bg-blue-500 relative overflow-hidden pt-24 pb-8 px-6 rounded-b-3xl">
            {/* Paths... */}
            <View className="h-72 w-72 rounded-full absolute -top-44 -left-36 bg-blue-400 opacity-30"></View>
            <View className="h-28 w-28 rounded-full absolute top-36 left-32 bg-blue-400 opacity-30"></View>
            <View className="h-10 w-10 rounded-full absolute top-20 right-12 bg-blue-400 opacity-30"></View>

            {/* Content */}
            <Text className="text-white text-3xl font-bold mt-2">{title}</Text>
            <Text className="text-white font-medium mt-2 text-sm">
                {description}
            </Text>
        </View>
    )
}

export default NestedPageTitle