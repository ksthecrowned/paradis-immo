import { View, Text, SafeAreaView, TextInput, Image, StatusBar, ScrollView, FlatList } from 'react-native'
import React from 'react'
import Animated from "react-native-reanimated"

import PropertyItem from '../components/PropertyItem'
import SearchForm from "../components/SearchForm"
import TopMenu from "../components/TopMenu"

import Icon from 'react-native-vector-icons/FontAwesome5'
import search from '../../assets/icons/search.png'
import equalizer from '../../assets/icons/equalizer.png'
import location from '../../assets/icons/location.png'
import bed from '../../assets/icons/bed.png'
import home from '../../assets/icons/home.png'
import bathtub from '../../assets/icons/bathtub.png'

import property02 from '../../assets/images/property02.jpg'
import property03 from '../../assets/images/property03.jpg'

const PROPERTIES = [
    {
        id: 1,
        title: "Magnifique appartement à louer",
        object: "location_journalière",
        objectLabel: "Location journalière",
        amount: 100000,
        price: "100.000 FCFA / jour",
        distance: "5km",
        nbRoom: 5,
        nbBed: 2,
        nbBath: 2,
        cover: property03
    },
    {
        id: 2,
        title: "Splendide villa à louer",
        object: "location",
        objectLabel: "Location",
        amount: 500000,
        price: "500.000 FCFA / mois",
        distance: "10km",
        nbRoom: 10,
        nbBed: 5,
        nbBath: 2,
        cover: property02
    },
    {
        id: 3,
        title: "Splendide villa à louer",
        object: "location",
        objectLabel: "Location",
        amount: 500000,
        price: "500.000 FCFA / mois",
        distance: "10km",
        nbRoom: 10,
        nbBed: 5,
        nbBath: 2,
        cover: property02
    }
]

const SearchScreen = () => {
    return (
        <SafeAreaView className="flex-1">
            
            {/* Top Menu */}
            <TopMenu statusBarStyle={'light-content'} screen={'search'} />
            
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
                <SafeAreaView className="bg-white px-4 py-3">
                    <Text className="text-lg text-gray-400">Resultats de recherche</Text>
                    <FlatList
                        data={PROPERTIES}
                        renderItem={({item}) => <PropertyItem property={item} />}
                        keyExtractor={item => item.id}
                    />
                </SafeAreaView>
            </Animated.ScrollView>
        </SafeAreaView>
    )
}

export default SearchScreen