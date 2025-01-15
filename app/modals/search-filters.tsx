import { Link, router } from "expo-router";
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, SlideInDown, FadeIn } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import Slider, { MarkerProps } from "@react-native-community/slider";
import { toMoneyFormat } from "@/utils/utilities";
import { Dimensions } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { AutocompleteDropdown } from "react-native-autocomplete-dropdown";

const SearchFilterScreen = () => {
    const screenWidth = Dimensions.get('window').width;
    const sliderWidth = screenWidth - 32;

    const [selectedNumsOfBedRoom, setSelectedNumsOfBedRoom] = useState();
    const [selectedNumsOfBathRoom, setSelectedNumsOfBathRoom] = useState();
    const [selectedCity, setSelectedCity] = useState("");

    const [isVisible, setIsVisible] = useState(true); 
    const translateY = useSharedValue(0); // Position verticale partagée

    // Style animé basé sur la position partagée
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    // Geste de glissement
    const gesture = Gesture.Pan()
        .onUpdate((event) => {
            // Mettre à jour la position en fonction du mouvement vertical
            translateY.value = Math.max(event.translationY, 0);
        })
        .onEnd(() => {
            // Renvoyer le panneau en place si ce n'est pas assez glissé pour être fermé
            if (translateY.value > 300) {
                translateY.value = withSpring(800, { overshootClamping: true }, () => {
                    // setIsVisible(false);
                });
            } else {
                translateY.value = withSpring(0); // Retour à la position initiale
            }
        });

    if (!isVisible) return null;
    return (
        <Animated.View
            entering={FadeIn}
            className="flex-1 items-center justify-end bg-black/40"
        >
            <Link href={'/(tabs)'} asChild onPress={() => setIsVisible(false)}>
                <Pressable style={StyleSheet.absoluteFill} />
            </Link>
            <Animated.View
                entering={SlideInDown.duration(500)}
                style={animatedStyle}
                className="p-4 pt-2 w-full h-[99%] bg-white rounded-t-3xl -mb-20 pb-20"
            >
                <GestureDetector gesture={gesture}>
                    <TouchableOpacity className="p-2 mb-2">
                        <View className="w-16 rounded-full mx-auto h-2 bg-gray-800" />
                    </TouchableOpacity>
                </GestureDetector>
                <View className="flex-row justify-between items-center">
                    <TouchableOpacity
                        onPress={() => {
                            router.back()
                        }}
                        className="rounded-full p-2 bg-blue-100/40"
                    >
                        <Ionicons name="close" size={20} color="black" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold">Filtres</Text>
                    <View className="opacity-0 w-8" />
                </View>
                <ScrollView 
                    showsVerticalScrollIndicator={false}
                    className="w-full flex-1 gap-y-5 mt-1 pb-6"
                >
                    <View className="rounded-full bg-blue-100/40 p-1 flex-row">
                        <View className="w-1/2 p-3 rounded-full bg-white shadow-lg">
                            <Text className="text-center font-bold">A louer</Text>
                        </View>
                        <View className="w-1/2 p-3 rounded-full">
                            <Text className="text-center font-bold">A vendre</Text>
                        </View>
                    </View>
                    <View>
                        <Text className="text-lg font-bold">Types de propriété</Text>
                        <View className="flex-row flex-wrap gap-2 mt-2">
                            <View className="flex-row items-center space-x-2 py-3 px-8 rounded-full bg-blue-200">
                                <Text className="text-blue-500">Maison</Text>
                                <Ionicons name="close" size={18} color="#3b82f6" />
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Appartement</Text>
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Appartement meublé</Text>
                            </View>
                            <View className="flex-row items-center space-x-2 py-3 px-8 rounded-full bg-blue-200">
                                <Text className="text-blue-500">Bureau</Text>
                                <Ionicons name="close" size={18} color="#3b82f6" />
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Terrain</Text>
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Boutique</Text>
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Villa</Text>
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Parcelle</Text>
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Studio</Text>
                            </View>
                        </View>
                    </View>
                    <View>
                        <Text className="text-lg font-bold">Prix (Francs CFA)</Text>
                        <View className="rounded-full bg-blue-100/40 p-1 flex-row mt-3">
                            <View className="w-1/2 p-3 rounded-full bg-white shadow-lg">
                                <Text className="text-center font-bold">Paie. Journalier</Text>
                            </View>
                            <View className="w-1/2 p-3 rounded-full">
                                <Text className="text-center font-bold">Paie. Mensuel</Text>
                            </View>
                        </View>
                        <View className="-mx-2 flex-row items-end">
                            <View className="w-8 bg-[#3b82f6]/50 h-[3px] mb-[7px]" />
                            <Slider
                                style={{width: sliderWidth, height: 40, marginTop: 24}}
                                minimumValue={5000}
                                value={5000}
                                lowerLimit={5000}
                                maximumValue={110000}
                                upperLimit={100000}
                                step={5000}
                                minimumTrackTintColor="#e5eafe"
                                maximumTrackTintColor="#3b82f6"
                                thumbTintColor="#3b82f6"
                                StepMarker={(props: MarkerProps) => {
                                    const { currentValue, stepMarked } = props;
                                    if(!stepMarked) return null;
                                    return (
                                        <View className="-mt-4 bg-blue-200 py-1 px-2">
                                            <Text className="text-blue-500">{toMoneyFormat(currentValue as number, 'XAF')}</Text>
                                        </View>
                                    );
                                }}
                            />
                        </View>
                    </View>
                    <View className="flex-row">
                        <View className="w-1/2 pr-2">
                            <Text className="text-lg font-bold">Chambre(s)</Text>
                            <View className="relative border border-gray-200 bg-gray-50 rounded-xl mt-2">
                                <Picker
                                    selectedValue={selectedNumsOfBedRoom}
                                    onValueChange={(itemValue, itemIndex) =>
                                        setSelectedNumsOfBedRoom(itemValue)
                                    }
                                    mode="dropdown"
                                >
                                    <Picker.Item label="01 Chambre" value="01" />
                                    <Picker.Item label="02 Chambres" value="02" />
                                    <Picker.Item label="03 Chambres" value="03" />
                                    <Picker.Item label="04 Chambres" value="04" />
                                    <Picker.Item label="05 Chambres" value="05" />
                                </Picker>
                            </View>
                        </View>
                        <View className="w-1/2 pl-2">
                            <Text className="text-lg font-bold">Salle(s) de bain</Text>
                            <View className="relative border border-gray-200 bg-gray-50 rounded-xl mt-2">
                                <Picker
                                    selectedValue={selectedNumsOfBathRoom}
                                    onValueChange={(itemValue, itemIndex) =>
                                        setSelectedNumsOfBathRoom(itemValue)
                                    }
                                    mode="dropdown"
                                >
                                    <Picker.Item label="01 Salle de bain" value="01" />
                                    <Picker.Item label="02 Salles de bain" value="02" />
                                    <Picker.Item label="03 Salles de bain" value="03" />
                                    <Picker.Item label="04 Salles de bain" value="04" />
                                    <Picker.Item label="05 Salles de bain" value="05" />
                                </Picker>
                            </View>
                        </View>
                    </View>
                    <View>
                        <Text className="text-lg font-bold">Ville</Text>
                        <View className="mt-2">
                            <AutocompleteDropdown
                                clearOnFocus={false}
                                closeOnBlur={true}
                                closeOnSubmit={false}
                                onClear={() => setSelectedCity('')}
                                onChangeText={(text: string) => {
                                    console.log('text', text);
                                }}
                                initialValue={selectedCity}
                                inputContainerStyle={{
                                    backgroundColor: '#f9fafb',
                                    borderRadius: 12,
                                    borderColor: '#e5e7eb',
                                    borderWidth: 1,
                                    paddingVertical: 8,
                                    paddingHorizontal: 4,
                                }}
                                // onSelectItem={setSelectedCity}
                                dataSet={[
                                    { id: '1', title: 'Brazzaville' },
                                    { id: '2', title: 'Pointe-Noire' },
                                    { id: '3', title: 'Dolisie' },
                                ]}
                            />
                        </View>
                    </View>
                    <View>
                        <Text className="text-lg font-bold">Autres détails</Text>
                        <View className="flex-row flex-wrap gap-2 mt-2">
                            <View className="flex-row items-center space-x-2 py-3 px-8 rounded-full bg-blue-200">
                                <Text className="text-blue-500">Cuisine</Text>
                                <Ionicons name="close" size={18} color="#3b82f6" />
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Climatisation</Text>
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Refigérateur</Text>
                            </View>
                            <View className="flex-row items-center space-x-2 py-3 px-8 rounded-full bg-blue-200">
                                <Text className="text-blue-500">Garage</Text>
                                <Ionicons name="close" size={18} color="#3b82f6" />
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Balcon</Text>
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Boutique</Text>
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Villa</Text>
                            </View>
                            <View className="py-3 px-8 rounded-full bg-blue-100/40">
                                <Text>Parcelle</Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
                <View className="my-4">
                    <TouchableOpacity
                        onPress={() => {router.push('../search')}}
                        className="rounded-xl bg-blue-500 py-4"
                    >
                        <Text className="text-base text-white text-center font-medium">
                            Voir les résultats
                        </Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </Animated.View>
    );
};

export default SearchFilterScreen;
