import { View } from "react-native";

export default function ParadisPatterns() {
    return (
        <>  
            <View className="absolute w-20 h-20 rounded-full bg-blue-400/50 -z-10 bottom-14 -right-4"></View>
            {/* <View className="absolute w-20 h-20 rounded-full bg-blue-400/50 -z-10 -bottom-14 left-0"></View> */}
            <View className="h-40 w-40 rounded-full absolute -top-20 -right-20 bg-blue-400/50 -z-10"></View>
            <View className="h-28 w-28 rounded-full absolute top-36 left-32 bg-blue-400/50 -z-10"></View>
            <View className="h-10 w-10 rounded-full absolute top-20 left-12 bg-blue-400/50 -z-10"></View>
        </>
    )
}