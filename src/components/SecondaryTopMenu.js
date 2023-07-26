import { View, Text, Image, StatusBar, TouchableOpacity } from 'react-native'
import React from 'react'
import { useNavigation } from '@react-navigation/native'

// Import assets
import backArrow from '../../assets/icons/back-arrow.png'
import userWhite from '../../assets/icons/user-white.png'

const SecondaryTopMenu = ({ screen, statusBarStyle }) => {
    const navigation = useNavigation()
    
    return (
        <>
            <View className="absolute w-full pt-12 pb-3 justify-between top-0 z-50 bg-blue-500 px-5 overflow-hidden">
                <StatusBar
                    backgroundColor="transparent"
                    translucent={true}
                    barStyle={statusBarStyle}
                />

                <View className="flex-row items-center space-x-4 z-50">
                    <TouchableOpacity className="rounded-md w-10 h-10 px-1.5 bg-gray-100/20 items-center justify-center border border-white" onPress={() => navigation.goBack()}>
                        <Image source={backArrow} className="h-7 w-7"></Image>
                    </TouchableOpacity>
                </View>

                {/* Paths... */}
                <View className="h-72 w-72 rounded-full absolute -top-44 -left-36 bg-blue-400 opacity-30"></View>
                <View className="h-10 w-10 rounded-full absolute top-20 right-12 bg-blue-400 opacity-30"></View>
            </View>
        </>
    )
}

export default SecondaryTopMenu