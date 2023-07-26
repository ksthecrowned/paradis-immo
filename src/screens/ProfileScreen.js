import { View, Text, FlatList, Image, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native'
import { useState, useRef, useMemo, useCallback } from 'react'
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useNavigation } from '@react-navigation/native'

import CustomBackdrop from "../components/CustomBackdrop"
import SecondaryTopMenu from "../components/SecondaryTopMenu"
import PropertyItem from "../components/PropertyItem"

// Import Screens
import EditProfileScreen from "../screens/EditProfileScreen"

// Import icons
import dots from '../../assets/icons/dots.png'
import telegram from '../../assets/icons/telegram.png'
import pen from '../../assets/icons/pen.png'
import verified from '../../assets/icons/verified.png'
import emptyStar from '../../assets/icons/empty-star.png'
import filledStar from '../../assets/icons/filled-star.png'
import location from '../../assets/icons/location.png'

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

const ProfileScreen = () => {
    const navigation = useNavigation()

    // ref
    const bottomSheetModalRef = useRef(null);

    // variables
    const snapPoints = useMemo(() => ["25%"], []);

    // callbacks
    const handlePresentModalPress = useCallback(() => {
        bottomSheetModalRef.current?.present()
    }, [])
    const handleSheetChanges = useCallback((index: number) => {
        console.log('handleSheetChanges', index)
    }, [])

    return (
        <SafeAreaView className="flex-1">
            <SecondaryTopMenu statusBarStyle={'light-content'} screen={'profile'} title="Kaiser D. Styve" /> 
            <ScrollView className="" showsVerticalScrollIndicator={false}>
                <View className="bg-blue-500 relative overflow-hidden pb-12 px-6 rounded-b-3xl pt-28">
                    {/* Paths... */}
                    <View className="h-72 w-72 rounded-full absolute -top-44 -left-36 bg-blue-400 opacity-30"></View>
                    <View className="h-28 w-28 rounded-full absolute top-36 left-32 bg-blue-400 opacity-30"></View>
                    <View className="h-10 w-10 rounded-full absolute top-20 right-12 bg-blue-400 opacity-30"></View>

                    <View className="flex-row space-x-4 items-center flex-1 relative mb-4">
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
                        <TouchableOpacity className="absolute bg-blue-400 p-2 rounded-full top-12 left-10"
                            onPress={() => {
                                navigation.navigate('EditProfile', {
                                    params: { user: 'jane' }
                                })
                            }}
                        >
                            <Image className="w-4 h-4" source={verified} />
                        </TouchableOpacity>
                    </View>
                    <View className="">
                        <Text className="font-bold mt-1 text-white text-base">11 rue Bakoukouyas, Poto-poto / Brazzaville</Text>
                    </View>
                    <View className="my-2 flex-row space-x-4 items-center">
                        <View className="flex-row space-x-4">
                            <Image source={filledStar} className="h-6 w-6" />
                            <Image source={filledStar} className="h-6 w-6" />
                            <Image source={filledStar} className="h-6 w-6" />
                            <Image source={emptyStar} className="h-6 w-6" />
                            <Image source={emptyStar} className="h-6 w-6" />
                        </View>
                        <Text className="text-white text-base">(14 avis)</Text>
                    </View>
                    <View className="w-full flex-row justify-between pt-2">
                        <View className="w-2/3 pr-2">
                            <TouchableOpacity className="rounded-lg bg-white py-4">
                                <Text className="text-base text-center font-medium">Se désabonner</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="w-1/3 flex-row space-x-2">
                            <TouchableOpacity className="rounded-lg py-4 px-2.5 bg-blue-400">
                                <Image className="w-7 h-6" source={telegram}></Image>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handlePresentModalPress} className="rounded-lg p-4 bg-blue-400">
                                <Image className="w-4 h-5 mt-0.5" source={dots}></Image>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                <SafeAreaView className="bg-white px-4 py-3">
                    {/* <Text className="text-lg text-gray-400">Resultats de recherche</Text> */}
                    {/* <FlatList
                        data={PROPERTIES}
                        renderItem={({item}) => <PropertyItem property={item} />}
                        keyExtractor={item => item.id}
                    /> */}
                </SafeAreaView>
            </ScrollView>
            <BottomSheetModal
                ref={bottomSheetModalRef}
                index={0}
                snapPoints={snapPoints}
                backdropComponent={(props) => <CustomBackdrop {...props} />}
                onChange={handleSheetChanges}
            >
                <BottomSheetScrollView>
                    <View className="p-4">
                        <Text className="text-xl">Suivre sur les réseaux sociaux</Text>  
                    </View>
                </BottomSheetScrollView>
            </BottomSheetModal>
        </SafeAreaView>
    )
}

export default ProfileScreen