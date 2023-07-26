import { View, Text, SafeAreaView, StatusBar, ScrollView, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import Animated from "react-native-reanimated"

import PropertyItem from '../components/PropertyItem'
import SearchForm from "../components/SearchForm"
import PrimaryTopMenu from "../components/PrimaryTopMenu"

import Icon from 'react-native-vector-icons/FontAwesome5'

import { getProperties } from '../../api' 

const SearchScreen = () => {
    const [ isLoading, setIsLoading ] = useState(true)
    const [ properties, setProperties ] = useState([])
    useEffect(() => {
        getProperties().then(data => {
            setProperties(data)
            setIsLoading(!isLoading)
        })
    }, [])

    return (
        <SafeAreaView className="flex-1">
            
            {/* Top Menu */}
            <PrimaryTopMenu statusBarStyle={'light-content'} screen={'search'} />
            
            <Animated.ScrollView>
                <View className="bg-blue-500 relative overflow-hidden pt-24 pb-12 px-5 rounded-b-3xl">
                    {/* Paths... */}
                    <View className="h-72 w-72 rounded-full absolute -top-44 -left-36 bg-blue-400 opacity-30"></View>
                    <View className="h-28 w-28 rounded-full absolute top-36 left-32 bg-blue-400 opacity-30"></View>
                    <View className="h-10 w-10 rounded-full absolute top-20 right-12 bg-blue-400 opacity-30"></View>

                    {/* Content */}

                    {/* Search & Filters Form */}
                    <SearchForm />

                    <View className="flex-row flex-wrap gap-3 mt-4">
                        <View className="flex-row items-center space-x-2 px-5 py-1 border-2 border-white rounded-full">
                            <Text className="text-white font-bold">Appartement</Text>
                            <Icon name="times" size={12} color="#fff" />
                        </View>
                        <View className="flex-row items-center space-x-2 px-5 py-1 border-2 border-white rounded-full">
                            <Text className="text-white font-bold">Bureau</Text>
                            <Icon name="times" size={12} color="#fff" />
                        </View>
                        <View className="flex-row items-center space-x-2 px-5 py-1 border-2 border-white rounded-full">
                            <Text className="text-white font-bold">2 Chambres</Text>
                            <Icon name="times" size={12} color="#fff" />
                        </View>
                    </View>
                </View>
                {!isLoading
                    ? <SafeAreaView className="bg-white px-4 py-3 pb-28">
                        <Text className="text-lg text-gray-400">Resultats de recherche</Text>
                        {
                            properties.map(property => {
                                return (
                                    <PropertyItem key={property._id} property={property} />
                                )
                            })
                        }
                      </SafeAreaView>
                    : <ActivityIndicator size="large" />
                }
            </Animated.ScrollView>
        </SafeAreaView>
    )
}

export default SearchScreen