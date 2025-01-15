import React, { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Text, TextInput, TouchableOpacity, View } from "react-native";
import MultiSelectComponent from "./MultiSelectComponent";
import { Ionicons } from "@expo/vector-icons";
import { InputShadow } from "@/constants/shadows";

const {height: SCREEN_HEIGHT } = Dimensions.get('window')
export default function SearchFilters() {
    return (
        <View className="flex-1">
            <View className="border-b border-blue-500/20 relative pb-2">
                <Text className="px-3 py-1 text-blue-900 text-xl font-bold text-center">Filtres</Text>
                <TouchableOpacity onPress={() => {}} style={InputShadow} className="absolute top-0 right-0 p-3">
                    <Ionicons color={'rgb(30 58 138)'} name="close" size={24} />
                </TouchableOpacity>
            </View>
            <View 
                className="mt-3"
                style={{ height: (SCREEN_HEIGHT - 250) }}
            >   
                <FlatList
                    scrollEnabled={true}
                    onEndReached={() => {
                        
                    }}
                    onStartReached={() => {
                        // setIsVisible(false)
                    }}
                    // onScroll={({nativeEvent}) => {
                    //     const y = nativeEvent.contentOffset.y
                    //     const height = nativeEvent.contentSize.height

                    //     if(Math.round(y) > Math.round((height / 10))) {
                    //         // setGrowBottomSheet(true)
                    //     }
                    //     if(Math.round(y) === 0) {
                    //         // let timer: any = null
                    //         // if(timer) clearTimeout(timer)
                    //         // timer = setTimeout(() => {
                    //         //     setIsVisible(false)
                    //         //     setContent(null)
                    //         // }, 3000)
                    //     }
                    // }}
                    showsVerticalScrollIndicator={false}
                    data={[
                        {
                            title: 'Ville',
                            placeholder: 'Selectionner une ville',
                            data: [
                                { label: 'Brazzaville', value: 'brazzaville' },
                                { label: 'Dolisie', value: 'dolisie' },
                                { label: 'Pointe-Noire', value: 'pointe-noire' }
                            ],
                            iconName: 'location-outline'
                        },
                        {
                            title: 'Categories',
                            placeholder: 'Selectionner une categorie',
                            data: [
                                { label: 'Appartement', value: 'appartement' },
                                { label: 'Maison', value: 'maison' },
                                { label: 'Terrain', value: 'terrain' },
                                { label: 'Villa', value: 'villa' },
                                { label: 'Bureau', value: 'bureau' },
                                { label: 'Studio', value: 'studio' },
                            ],
                            iconName: 'list'
                        },
                        {
                            title: 'Prix (FCFA)',
                            placeholder: 'Selectionner un prix',
                            data: []
                        },
                        {
                            title: 'Equipements',
                            placeholder: 'Selectionner un equipement',
                            data: [
                                { label: "Wifi", value: "wifi" },
                                { label: "Climatisation", value: "climatisation" },
                                { label: "Cuisine", value: "cuisine" },
                                { label: "Jardin", value: "jardin" },
                                { label: "Cave", value: "cave" },
                                { label: "Salle de bain", value: "salle-de-bain" },
                            ],
                            iconName: 'list'
                        },
                        {
                            title: 'Nbre de chambres',
                            placeholder: 'Selectionner une valeur',
                            data: [
                                { label: "1", value: "1" },
                                { label: "2", value: "2" },
                                { label: "3", value: "3" },
                                { label: "4", value: "4" },
                                { label: "5", value: "5" },
                            ],
                            iconName: 'bed-outline'
                        },
                        {
                            title: 'Nbre de salles de bains',
                            placeholder: 'Selectionner une valeur',
                            data: [
                                { label: "1", value: "1" },
                                { label: "2", value: "2" },
                                { label: "3", value: "3" },
                                { label: "4", value: "4" },
                                { label: "5", value: "5" },
                            ]
                        },
                    ]}
                    renderItem={({ item, index }) => (
                        <View className="w-full p-2">
                            <Text className="text-blue-900 text-base font-bold mb-3">{item?.title}</Text>
                            {index === 2 && (
                                <View className="flex-row">
                                    <View className="w-1/2 pr-2 relative">
                                        <TextInput 
                                            placeholder="Minimum" 
                                            className="text-base p-2.5 bg-white rounded-lg"
                                            keyboardType="numeric" 
                                            style={InputShadow}
                                        />
                                    </View>
                                    <View className="w-1/2 pl-2 relative">
                                        <TextInput 
                                            placeholder="Maximum" 
                                            className="text-base p-2.5 bg-white rounded-lg" 
                                            keyboardType="numeric"
                                            style={InputShadow}
                                        />
                                    </View>
                                </View>
                            )}
                            {index !== 2 && (
                                <MultiSelectComponent
                                    data={item?.data}
                                    iconName={item?.iconName}
                                    placeholder={item?.placeholder}
                                />  
                            )}
                        </View>
                    )}
                />
            </View>
            <View className="w-full flex-row items-center justify-between border-t mt-4 pt-4 border-gray-300/20">
                <View className="w-1/2 pr-2 relative">
                    <TouchableOpacity 
                        onPress={() => {
                           
                        }}
                        className="p-3 border border-blue-500 rounded-full"
                    >
                        <Text className="text-center text-blue-500 font-bold">Fermer</Text>
                    </TouchableOpacity>
                </View>
                <View className="w-1/2 pl-2">
                    <TouchableOpacity className="p-3 bg-blue-500 rounded-full">
                        <Text className="text-center font-bold text-white">Filtrer</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}