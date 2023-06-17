import { View, Text, SafeAreaView, StatusBar, ScrollView } from 'react-native'
import React from 'react'
import TopMenu from "../components/TopMenu"

const NotificationsScreen = () => {
    return (
        <SafeAreaView className="flex-1">
            
            {/* Top Menu */}
            <TopMenu statusBarStyle={'light-content'} screen={'notifications'} />

            <ScrollView>
                <View className="bg-blue-500 relative overflow-hidden pt-24 pb-8 px-6 rounded-b-3xl">
                    {/* Paths... */}
                    <View className="h-72 w-72 rounded-full absolute -top-44 -left-36 bg-blue-400 opacity-30"></View>
                    <View className="h-28 w-28 rounded-full absolute top-36 left-32 bg-blue-400 opacity-30"></View>
                    <View className="h-10 w-10 rounded-full absolute top-20 right-12 bg-blue-400 opacity-30"></View>

                    {/* Content */}
                    <Text className="text-white text-3xl font-bold mt-2">Mes Notifications</Text>
                </View>
                <SafeAreaView className="bg-white px-4 py-3">
                    <Text className="text-xl font-medium">Aujourd'hui</Text>
                    <View className="flex-row space-x-2 bg-gray-100 rounded-md border border-gray-200 p-3 mt-3">
                        <View className="w-14 h-14 bg-red-600 rounded-full"></View>
                        <View>
                            <Text className="text-gray-800 font-bold text-base">Nouvel alerte immobilier</Text>
                            <Text className="text-gray-500 break-words text-xs">Signal qui prévient d'un danger</Text>
                        </View>
                    </View>
                    <View className="flex-row space-x-2 bg-gray-100 rounded-md border border-gray-200 p-3 mt-3">
                        <View className="w-14 h-14 bg-red-600 rounded-full"></View>
                        <View>
                            <Text className="text-gray-800 font-bold text-base">Nouvel alerte immobilier</Text>
                            <Text className="text-gray-500 break-words text-xs">Signal qui prévient d'un danger</Text>
                        </View>
                    </View>
                    <View className="flex-row space-x-2 bg-gray-100 rounded-md border border-gray-200 p-3 mt-3">
                        <View className="w-14 h-14 bg-red-600 rounded-full"></View>
                        <View>
                            <Text className="text-gray-800 font-bold text-base">Nouvel alerte immobilier</Text>
                            <Text className="text-gray-500 break-words text-xs">Signal qui prévient d'un danger</Text>
                        </View>
                    </View>
                    <View className="mt-3">
                        <Text className="text-xl font-medium">Hier</Text>
                        <View className="flex-row space-x-2 bg-gray-100 rounded-md border border-gray-200 p-3 mt-3">
                            <View className="w-14 h-14 bg-red-600 rounded-full"></View>
                            <View>
                                <Text className="text-gray-800 font-bold text-base">Nouvel alerte immobilier</Text>
                                <Text className="text-gray-500 break-words text-xs">Signal qui prévient d'un danger</Text>
                            </View>
                        </View>
                        <View className="flex-row space-x-2 bg-gray-100 rounded-md border border-gray-200 p-3 mt-3">
                            <View className="w-14 h-14 bg-red-600 rounded-full"></View>
                            <View>
                                <Text className="text-gray-800 font-bold text-base">Nouvel alerte immobilier</Text>
                                <Text className="text-gray-500 break-words text-xs">Signal qui prévient d'un danger</Text>
                            </View>
                        </View>
                        <View className="flex-row space-x-2 bg-gray-100 rounded-md border border-gray-200 p-3 mt-3">
                            <View className="w-14 h-14 bg-red-600 rounded-full"></View>
                            <View>
                                <Text className="text-gray-800 font-bold text-base">Nouvel alerte immobilier</Text>
                                <Text className="text-gray-500 break-words text-xs">Signal qui prévient d'un danger</Text>
                            </View>
                        </View>
                    </View>
                </SafeAreaView>
            </ScrollView>
        </SafeAreaView>
    )
}

export default NotificationsScreen