import { View, Text, Image, StatusBar, TouchableOpacity } from 'react-native'
import React from 'react'
import { useNavigation } from '@react-navigation/native'

// Import assets
import userWhite from '../../assets/icons/user-white.png'
import search from '../../assets/icons/search.png'

const PrimaryTopMenu = ({ statusBarStyle }) => {
    const navigation = useNavigation()
    
    return (
        <>
            <View className="absolute w-full pt-12 pb-3 justify-between top-0 z-50 bg-blue-500 px-5 overflow-hidden">
                <StatusBar
                    backgroundColor="transparent"
                    translucent={true}
                    barStyle={statusBarStyle}
                />

                {/* Bars */}
                <View className="flex-row items-center justify-between z-50">
                    <TouchableOpacity className="space-y-2 z-50" onPress={() => navigation.openDrawer()}>
                        <View className="h-1 rounded-full w-4 bg-white"></View>
                        <View className="h-1 rounded-full w-8 bg-white"></View>
                        <View className="h-1 rounded-full w-6 bg-gray-50"></View>
                    </TouchableOpacity> 
                    <View className="flex-row space-x-4">
                        <TouchableOpacity
                            onPress={() => {
                                navigation.navigate('Profile', {
                                    params: { user: 'jane' }
                                })
                            }}
                        >
                            <Image source={search} className="h-9 w-9"></Image>
                        </TouchableOpacity>
                        {/* <TouchableOpacity
                            onPress={() => {
                                navigation.navigate('Profile', {
                                    params: { user: 'jane' }
                                })
                            }}
                        >
                            <Image source={userWhite} className="h-9 w-9"></Image>
                        </TouchableOpacity> */}
                    </View>
                </View>

                {/* Paths... */}
                <View className="h-72 w-72 rounded-full absolute -top-44 -left-36 bg-blue-400 opacity-30"></View>
                <View className="h-10 w-10 rounded-full absolute top-20 right-12 bg-blue-400 opacity-30"></View>
            </View>
        </>
    )
}

export default PrimaryTopMenu