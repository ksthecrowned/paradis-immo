import { View, Text, SafeAreaView, StatusBar, ScrollView, Image, TouchableOpacity } from 'react-native'
import React from 'react'
import { useNavigation } from '@react-navigation/native'

// Import components
import TopMenu from "../components/TopMenu"

// Import Screens
import AddPropertyScreen from "../screens/AddPropertyScreen"
import ProfileScreen from "../screens/ProfileScreen"

// Import Asszets
import addNew from '../../assets/icons/add-new.png'
import city from '../../assets/icons/city.png'
import gear from '../../assets/icons/gear.png'
import property03 from '../../assets/images/property03.jpg'
import accountBlue from '../../assets/drawericons/account-blue.png'
import questionBlue from '../../assets/drawericons/question-blue.png'
import shareBlue from '../../assets/drawericons/share-blue.png'
import rightArrow from '../../assets/icons/right-arrow.png'


const SettingsScreen = () => {
    const navigation = useNavigation()

    return (
        <SafeAreaView className="flex-1">
            
            {/* Top Menu */}
            <TopMenu statusBarStyle={'light-content'} showBackArrow={false} />

            <ScrollView>
                <View className="bg-blue-500 relative overflow-hidden py-24 px-6 rounded-b-3xl">
                    {/* Paths... */}
                    <View className="h-72 w-72 rounded-full absolute -top-44 -left-36 bg-blue-400 opacity-30"></View>
                    <View className="h-28 w-28 rounded-full absolute top-36 left-32 bg-blue-400 opacity-30"></View>
                    <View className="h-10 w-10 rounded-full absolute top-20 right-12 bg-blue-400 opacity-30"></View>

                    <View className="flex-row space-x-4 items-center flex-1">
                        <View className="h-20 w-20 rounded-full border-4 border-white shadow-lg overflow-hidden">
                            {/* <Image className="w-full h-full" source={property03}></Image> */}
                            <View className="h-full w-full items-center justify-center bg-blue-800">
                                <Text className="font-bold text-5xl pt-3 text-white">K</Text>
                            </View>
                        </View>
                        <View>
                            <Text className="font-bold text-xl text-white">Kaiser D. Styve</Text>
                            <Text className="font-bold mt-1 text-white">kaiserstyve2@gmail.com</Text>
                        </View>
                    </View>
                </View>
                <SafeAreaView className="px-5 py-4">
                    <View className="">
                        <View className="bg-white rounded-3xl shadow-md -mt-20 px-5 py-10 space-y-6 mb-4">
                            <TouchableOpacity className="flex-row items-center justify-between"
                                onPress={() => {
                                    navigation.navigate('Profile', {
                                        screen: 'ProfileScreen',
                                        params: { user: 'jane' }
                                    })
                                }}
                            >
                                <View className="flex-row items-center space-x-2">
                                    <Image className="w-8 h-8" source={accountBlue} />
                                    <Text className="text-base">Mon Profile</Text>
                                </View>
                                <Image className="w-5 h-5" source={rightArrow} />
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-row items-center justify-between">
                                <View className="flex-row items-center space-x-2">
                                    <View className="border-2 border-blue-500 rounded-full overflow-hidden p-0.5">
                                        <Image className="w-6 h-6 rounded-full" source={city} />
                                    </View>
                                    <Text className="text-base">Mes propriétés</Text>
                                </View>
                                <Image className="w-5 h-5" source={rightArrow} />
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-row items-center justify-between" 
                                onPress={() => {
                                    navigation.navigate('Root', {
                                        screen: 'AddPropertyScreen',
                                        params: { user: 'jane' }
                                    })
                                }}
                            >
                                <View className="flex-row items-center space-x-2">
                                    <Image className="w-8 h-8" source={addNew} />
                                    <Text className="text-base">Ajouter une propriété</Text>
                                </View>
                                <Image className="w-5 h-5" source={rightArrow} />
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-row items-center justify-between">
                                <View className="flex-row items-center space-x-2">
                                    <Image className="w-8 h-8" source={accountBlue} />
                                    <Text className="text-base">Mon Profile</Text>
                                </View>
                                <Image className="w-5 h-5" source={rightArrow} />
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-row items-center justify-between">
                                <View className="flex-row items-center space-x-2">
                                    <Image className="w-8 h-8" source={accountBlue} />
                                    <Text className="text-base">Mon Profile</Text>
                                </View>
                                <Image className="w-5 h-5" source={rightArrow} />
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-row items-center justify-between">
                                <View className="flex-row items-center space-x-2">
                                    <Image className="w-8 h-8" source={shareBlue} />
                                    <Text className="text-base">Partager l'application</Text>
                                </View>
                                <Image className="w-5 h-5" source={rightArrow} />
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-row items-center justify-between">
                                <View className="flex-row items-center space-x-2">
                                    <Image className="w-8 h-8" source={questionBlue} />
                                    <Text className="text-base">Centre d'aide</Text>
                                </View>
                                <Image className="w-5 h-5" source={rightArrow} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity className="">
                            <Text className="text-center text-base">Se déconnecter</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </ScrollView>
        </SafeAreaView>
    )
}

export default SettingsScreen