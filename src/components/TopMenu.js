import { View, Text, Image, StatusBar, TouchableOpacity } from 'react-native'
import React from 'react'
import { useNavigation } from '@react-navigation/native'

// Import assets
import backArrow from '../../assets/icons/back-arrow.png'
import userWhite from '../../assets/icons/user-white.png'

import ProfileScreen from "../screens/ProfileScreen"

const TopMenu = ({ screen, showBackArrow, statusBarStyle, title }) => {
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
                {!showBackArrow 
                    ? <View className="flex-row items-center justify-between z-50">
                        <TouchableOpacity className="space-y-2 z-50" onPress={() => navigation.openDrawer()}>
                            <View className="h-1 rounded-full w-4 bg-white"></View>
                            <View className="h-1 rounded-full w-8 bg-white"></View>
                            <View className="h-1 rounded-full w-6 bg-gray-50"></View>
                        </TouchableOpacity> 
                        <TouchableOpacity
                            onPress={() => {
                                navigation.navigate('Profile', {
                                    screen: 'ProfileScreen',
                                    params: { user: 'jane' }
                                })
                            }}
                        >
                            <Image source={userWhite} className="h-9 w-9"></Image>
                        </TouchableOpacity>
                      </View>

                    : <View className="flex-row items-center space-x-4 z-50">
                        <TouchableOpacity className="rounded-md w-10 h-10 px-1.5 bg-gray-100/20 items-center justify-center border border-white" onPress={() => navigation.goBack()}>
                            <Image source={backArrow} className="h-7 w-7"></Image>
                        </TouchableOpacity>
                        <Text className="text-white text-xl font-medium">{title ? title : ''}</Text>
                      </View>
                }

                {/* Paths... */}
                <View className="h-72 w-72 rounded-full absolute -top-44 -left-36 bg-blue-400 opacity-30"></View>
                <View className="h-10 w-10 rounded-full absolute top-20 right-12 bg-blue-400 opacity-30"></View>
            </View>
        </>
    )
}

export default TopMenu