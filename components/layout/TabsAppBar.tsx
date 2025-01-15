import React from 'react'
import { View, Text, StatusBar } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { HelloWave } from '../HelloWave'

export default function TabsAppBar(props: any) {
    const { route: { name } } = props

    return (
        <View className='bg-white'>
            <StatusBar barStyle={'default'} />
            <View className='bg-blue-500 pt-10 pb-4 px-5 relative overflow-hidden'>{/*rounded-bl-3xl*/}
                <View className='flex-row items-center justify-between space-x-4'>
                    <View className='flex-1 flex-row'>
                        <View className="space-y-2">
                            <View className="h-1 rounded-full w-4 bg-white"></View>
                            <View className="h-1 rounded-full w-8 bg-white"></View>
                            <View className="h-1 rounded-full w-6 bg-gray-50"></View>
                        </View>
                    </View>
                    <View className='flex-row items-center space-x-2'>
                        <Link href={"/notifications"}>
                            <View className='h-10 w-10 rounded-full border border-gray-300/20 items-center justify-center'>
                                <Ionicons name='notifications' color={"#FFF"} size={24} />
                            </View>
                        </Link>
                    </View>
                </View>
                <View className="absolute w-20 h-20 rounded-full bg-blue-400/50 -z-10 bottom-14 -right-4"></View>
                <View className="absolute w-20 h-20 rounded-full bg-blue-400/50 -z-10 -bottom-14 left-0"></View>
            </View>
        </View>
    )
}