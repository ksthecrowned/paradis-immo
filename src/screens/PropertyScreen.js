import { View, Text, SafeAreaView, TextInput, Image, StatusBar, ScrollView, SectionList, TouchableOpacity } from 'react-native'
import Markdown from 'react-native-markdown-text'
import React from 'react'

import SlideShow from '../components/SlideShow'
import { useNavigation } from '@react-navigation/native'

import property02 from '../../assets/images/property02.jpg'
import property03 from '../../assets/images/property03.jpg'

import bedBlue from '../../assets/icons/bed-blue.png'
import homeBlue from '../../assets/icons/home-blue.png'
import bathtubBlue from '../../assets/icons/bathtub-blue.png'
import heart from '../../assets/icons/heart.png'
import locationGray from '../../assets/icons/location-gray.png'
import backArrow from '../../assets/icons/back-arrow.png'
import checked from '../../assets/icons/checked.png'
import phone from '../../assets/icons/phone.png'

console.log(property02)


const PROPERTY_DETAILS = [
    {
        title: "Distances",
        data: [
            {
                label: "Marché",
                value: "150m"
            },
            {
                label: "Ecole",
                value: "400m"
            }
        ]
    },
    {
        title: 'Détails intérieurs',
        data: [
            {
                title: "Cuisine équipée",
                isBool: true,
                available: true,
            },
            {
                title: "Climatisation",
                isBool: true,
                available: true,
            },
            {
                title: "Micro-onde",
                isBool: true,
                available: true,
            },
            {
                title: "Internet",
                isBool: true,
                available: true,
            }
        ],
    },
    {
        title: 'Détails extérieurs',
        data: [
            {
                title: "Garage",
                isBool: true,
                available: true,
            },
            {
                title: "Piscine",
                isBool: true,
                available: true,
            },
            {
                title: "Jardin",
                isBool: true,
                available: true,
            }
        ],
    }
]

const BoolPropertyDetail = ({item}) => (
    <View className="px-6">
        <View className="flex-row justify-between items-center rounded-md py-3 px-4 mb-2 bg-white" style={{
            shadowColor: "rgb(59, 130, 246)",
            shadowOffset: {
                width: 0,
                height: 18,
            },
            shadowOpacity:  0.25,
            shadowRadius: 20.00,
            elevation: 7
        }}>
            <Text className="text-base">{item.title}</Text>
            {item.available && <Image source={checked} className="w-6 h-6"></Image>}
        </View>
    </View>
)

const StrPropertyDetail = ({item}) => (
    <View className="px-6">
        <View className="flex-row justify-between items-center rounded-md py-3 px-4 mb-2 bg-white" style={{
            shadowColor: "rgb(59, 130, 246)",
            shadowOffset: {
                width: 0,
                height: 18,
            },
            shadowOpacity:  0.25,
            shadowRadius: 20.00,
            elevation: 7
        }}>
            <Text className="text-base">{item.label}</Text>
            <Text className="text-base">{item.value}</Text>
        </View>
    </View>
)

const PropertyScreen = () => {
    const navigation = useNavigation()

    return (
        <SafeAreaView className="flex-1">
            <StatusBar
                backgroundColor="transparent"
                translucent={true}
                barStyle={'dark-content'}
            />

            <View className="absolute top-12 px-6 z-50 w-full flex-row items-center justify-between">
                <TouchableOpacity className="rounded-md h-full px-1.5 bg-gray-100/20 items-center justify-center border border-white" onPress={() => navigation.goBack()}>
                    <Image source={backArrow} className="h-7 w-7"></Image>
                </TouchableOpacity>
                <View className="rounded-md bg-white p-3">
                    <Text className="font-bold">200.000.000 FCFA / mois</Text>
                </View>
                <View className="rounded-md h-full px-2 bg-gray-100/20 items-center justify-center border border-white">
                    <Image source={heart} className="h-7 w-7"></Image>
                </View>
            </View>

            <SlideShow />

            <ScrollView className="-mt-5 rounded-t-3xl bg-white">
                <View className="p-6">
                    <Text className="font-bold text-2xl text-gray-800">Magnifique appartement</Text>
                    <View className="flex-row -ml-1 space-x-1 items-center mt-2"> 
                        <Image source={locationGray} className="w-6 h-5"></Image>
                        <Text className="text-gray-400">Batignolles, Brazzaville CG</Text>
                    </View>
                    <View className="mt-2">
                        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} className="-mx-6">
                            <View className="h-28 w-28 rounded-2xl bg-white items-center justify-center mx-2 mt-4 mb-8 ml-4" style={{
                                shadowColor: "rgb(59, 130, 246)",
                                shadowOffset: {
                                    width: 0,
                                    height: 18,
                                },
                                shadowOpacity:  0.25,
                                shadowRadius: 20.00,
                                elevation: 24
                            }}>
                                <Image source={homeBlue} className="h-8 w-8 mb-2 object-cover" ></Image>
                                <Text className="font-bold uppercase text-xs">4 pièces</Text>
                            </View>
                            <View className="h-28 w-28 rounded-2xl bg-white items-center justify-center mx-2 mt-4 mb-8" style={{
                                shadowColor: "rgb(59, 130, 246)",
                                shadowOffset: {
                                    width: 0,
                                    height: 18,
                                },
                                shadowOpacity:  0.25,
                                shadowRadius: 20.00,
                                elevation: 24
                            }}>
                                <Image source={bedBlue} className="h-8 w-8 mb-2 object-cover" ></Image>
                                <Text className="font-bold uppercase text-xs">2 chambres</Text>
                            </View>
                            <View className="h-28 w-28 rounded-2xl bg-white items-center justify-center mx-2 mt-4 mb-8" style={{
                                shadowColor: "rgb(59, 130, 246)",
                                shadowOffset: {
                                    width: 0,
                                    height: 18,
                                },
                                shadowOpacity:  0.25,
                                shadowRadius: 20.00,
                                elevation: 24
                            }}>
                                <Image source={bathtubBlue} className="h-8 w-8 mb-2 object-cover" ></Image>
                                <Text className="font-bold uppercase text-xs">1 Salle de bain</Text>
                            </View>
                            <View className="h-28 w-28 rounded-2xl bg-white items-center justify-center mx-2 mt-4 mb-8" style={{
                                shadowColor: "rgb(59, 130, 246)",
                                shadowOffset: {
                                    width: 0,
                                    height: 18,
                                },
                                shadowOpacity:  0.25,
                                shadowRadius: 20.00,
                                elevation: 24
                            }}>
                                <Image source={bathtubBlue} className="h-8 w-8 mb-2 object-cover" ></Image>
                                <Text className="font-bold uppercase text-xs">1 Cuisine</Text>
                            </View>
                        </ScrollView>
                    </View>
                    <View className="bg-white rounded-md p-4 -mx-2" style={{
                            shadowColor: "rgb(59, 130, 246)",
                            shadowOffset: {
                                width: 0,
                                height: 18,
                            },
                            shadowOpacity:  0.25,
                            shadowRadius: 20.00,
                            elevation: 24
                        }}>
                        <Text className="font-medium text-xl text-blue-900">Description</Text>
                        <Text className="text-gray-500 leading-5 tracking-wide mt-1">
                            Cet appartement de deux chambres se trouve au quatrième étage d'un immeuble moderne. Lorsque vous entrez dans l'appartement, vous êtes accueilli par un hall d'entrée spacieux qui mène à toutes les pièces principales.
                        </Text>
                    </View>
                    <SafeAreaView className="pb-8 -mx-4">
                        <SectionList
                            className="-m-4 py-8"
                            sections={PROPERTY_DETAILS}
                            keyExtractor={(item, index) => item + index}
                            renderItem={({item}) => (
                                item.isBool ? <BoolPropertyDetail item={item} />
                                : <StrPropertyDetail item={item} />
                            )}
                            renderSectionHeader={({section: {title, data}}) => (
                                data.length > 0 && <Text className="font-medium text-xl mb-2 mt-4 text-blue-900 px-6">{title}</Text>
                            )}
                        />
                    </SafeAreaView>
                </View>
            </ScrollView>

            <View className="flex-1 absolute bottom-0 w-full bg-blue-500 p-5 rounded-xl">
                <TouchableOpacity>
                    <Text className="text-center text-white text-base font-medium">Demander une visite</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
}

export default PropertyScreen