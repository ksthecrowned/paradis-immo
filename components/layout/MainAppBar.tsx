import React, { useEffect } from 'react'
import { View, Text, StatusBar, TouchableOpacity, TextInput } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Link, useNavigation } from 'expo-router'
import HomeSearchInput from '../home/HomeSearchInput'

export default function MainAppBar(props: any) {
    const { route: { name, params } } = props
    const navigation = useNavigation()

    let label: string = ''
    switch (name) {
        case "categories/index":
            label = "Catégories"
            break;
        case "categories/[id]/index":
            label = "Catégories"
            break;
        case "explore":
            label = "Recommandations"
            break;
        case "profile":
            label = "Mon profil"
            break;
        case "favorites":
            label = "Mes favoris"
            break;
    
        default:
            label = name
            break;
    }

    switch (params.id) {
        case 1:
            label = "Maisons"
            break;
        case 2:
            label = "Appartements"
            break;
        default:
            break;
    }

    useEffect(() => {
        
    }, [params])
    return (
        <View>
            <StatusBar barStyle={'default'} />
            <View className='bg-blue-500 pt-10 pb-3 px-5 relative overflow-hidden'>
                <View className='flex-row items-center justify-between space-x-4'>
                    <View className='flex-1 flex-row items-center space-x-2'>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Ionicons name='arrow-back' color={"#FFF"} size={24} />
                        </TouchableOpacity>
                        {name !== "search" && <Text className='text-2xl font-bold text-white mr-1 capitalize'>{label}</Text>}
                        {name === "search" && (
                            <TextInput 
                                className='flex-1 border border-gray-300/20 rounded-full px-5 py-1.5 text-base text-white'
                                placeholderTextColor="rgb(209, 213, 219)"
                                placeholder='Saisissez quelque chose...'
                                autoFocus
                            />
                        )}
                    </View>
                    <View className='flex-row items-center space-x-2'>
                        {name !== "search" && (
                            <Link href={"/search"}>
                                <View className='h-10 w-10 rounded-full border border-gray-300/20 items-center justify-center'>
                                    <Ionicons name='search-outline' color={"#FFF"} size={24} />
                                </View>
                            </Link>
                        )}
                        {name !== "notifications" && name !== "search" && (
                            <Link href={"/notifications"}>
                                <View className='h-10 w-10 rounded-full border border-gray-300/20 items-center justify-center'>
                                    <Ionicons name='notifications' color={"#FFF"} size={24} />
                                </View>
                            </Link>
                        )}
                    </View>
                </View>
                <View className="absolute w-20 h-20 rounded-full bg-blue-400/50 -z-10 bottom-14 -right-4"></View>
                <View className="absolute w-20 h-20 rounded-full bg-blue-400/50 -z-10 -bottom-14 left-0"></View>
            </View>
        </View>
    )
}