import { View, Text, FlatList, Image, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native'
import { useState, useRef, useMemo, useCallback } from 'react'
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useNavigation } from '@react-navigation/native'

import CustomBackdrop from "../components/CustomBackdrop"
import BackButton from "../components/BackButton"
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
            <BackButton /> 
            <ScrollView className="" showsVerticalScrollIndicator={false}>
                <View className="bg-blue-500 relative overflow-hidden py-12 px-6 rounded-b-3xl">
                    {/* Paths... */}
                    <View className="h-72 w-72 rounded-full absolute -top-44 -left-36 bg-blue-400 opacity-30"></View>
                    <View className="h-28 w-28 rounded-full absolute top-36 left-32 bg-blue-400 opacity-30"></View>
                    <View className="h-10 w-10 rounded-full absolute top-20 right-12 bg-blue-400 opacity-30"></View>

                    <View className="space-y-4 items-center flex-1">
                        <View className="h-28 w-28 rounded-full border-4 border-white shadow-lg overflow-hidden">
                            {/* <Image className="w-full h-full" source={property03}></Image> */}
                            <View className="h-full w-full items-center justify-center bg-blue-800">
                                <Text className="font-bold text-5xl pt-3 text-white">K</Text>
                            </View>
                        </View>
                        <TouchableOpacity className="absolute bg-blue-400 p-2 rounded-full top-16 right-28"
                            onPress={() => {
                                navigation.navigate('EditProfile', {
                                    screen: 'EditProfileScreen',
                                    params: { user: 'jane' }
                                })
                            }}
                        >
                            <Image className="w-4 h-4" source={pen} />
                        </TouchableOpacity>
                        <View className="">
                            <Text className="font-bold text-2xl text-white text-center">Kaiser D. Styve</Text>
                            <Text className="font-bold mt-1 text-white text-center text-base">14 rue Bakoukouyas, Brazzaville</Text>
                        </View>
                        <View>
                            <View className="flex-row space-x-4">
                                <Image source={filledStar} className="h-6 w-6" />
                                <Image source={filledStar} className="h-6 w-6" />
                                <Image source={filledStar} className="h-6 w-6" />
                                <Image source={emptyStar} className="h-6 w-6" />
                                <Image source={emptyStar} className="h-6 w-6" />
                            </View>
                        </View>
                        <View className="w-full flex-row justify-between pt-2">
                            <View className="w-2/3 pr-2">
                                <TouchableOpacity className="rounded-lg bg-white py-4">
                                    <Text className="text-base text-center font-medium">S'abonner</Text>
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
                        {/* <View>
                            <Text className="text-white text-center leading-relaxed">
                                Un agent immobilier est un professionnel spécialisé dans la vente, l'achat et la location de biens immobiliers tels que des maisons, des appartements, des terrains, des locaux commerciaux, etc.
                            </Text>
                        </View> */}
                    </View>
                </View>
                <SafeAreaView className="bg-white px-4 py-3">
                    {/* <Text className="text-lg text-gray-400">Resultats de recherche</Text> */}
                    <FlatList
                        data={PROPERTIES}
                        renderItem={({item}) => <PropertyItem property={item} />}
                        keyExtractor={item => item.id}
                    />
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