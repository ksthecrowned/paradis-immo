import React, { useState } from 'react';

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, StatusBar, Text, TouchableOpacity } from 'react-native';
import { Link, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import { View } from 'react-native-animatable';
import * as Sharing from 'expo-sharing';
import { cardShadow, InputShadow } from '@/constants/shadows';

export default function PropertyScreen() {
    const { id } = useLocalSearchParams();
    const navigation = useNavigation();
    const [currentImageUrl, setCurrentImageUrl] = useState<string>('');
    const [showFullDesc, setShowFullDesc] = useState<boolean>(false);
    return (
        <View className='flex-1'>
            <StatusBar barStyle={'dark-content'} /> 
            <View className='absolute top-0 left-0 right-0 z-50'>
                <View className="w-full flex-row justify-between p-5 mt-6">
                    <View>
                        <TouchableOpacity 
                            style={InputShadow} 
                            onPress={() => navigation.goBack()} 
                            className='px-2.5 py-2 bg-blue-600 rounded-md flex-row justify-center items-center space-x-2'
                        >
                            <Ionicons name='chevron-back' color={"#FFF"} size={24} />
                        </TouchableOpacity>
                    </View>
                    <View className='flex-row items-center space-x-2'>
                        <View 
                            style={InputShadow} 
                            className='p-2 bg-white rounded-full flex-row justify-center items-center space-x-2'
                        >
                            <Ionicons name='heart-outline' color={"#3b82f6"} size={24} />
                        </View>
                        <TouchableOpacity 
                            style={InputShadow}
                            onPress={async () => {
                                
                            }} 
                            className='p-2 bg-blue-600 rounded-full flex-row justify-center items-center space-x-2 pr-2.5'
                        >
                            <Ionicons name='share-social-outline' color={"#FFF"} size={24} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
            <ScrollView className='flex-1 bg-white' showsVerticalScrollIndicator={false}>
                <View className='w-full h-[450px] overflow-hidden relative' style={InputShadow}>
                    <Image
                        source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                        // source={{ uri: currentImageUrl }}
                        className='object-cover w-full h-full'
                    />
                    <View className="absolute bottom-14 right-4 gap-2">
                        <TouchableOpacity
                            onPress={() => {
                                setCurrentImageUrl(require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg'))
                            }}
                            className='w-[70px] h-[70px] rounded-lg overflow-hidden border-2 border-white'>
                            <Image
                                source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                                className='object-cover w-full h-full'
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                setCurrentImageUrl(require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg'))
                            }}
                            className='w-[70px] h-[70px] rounded-lg overflow-hidden border-2 border-white'>
                            <Image
                                source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                                className='object-cover w-full h-full'
                            />
                        </TouchableOpacity>
                        <Link href={"/galerie"}>
                            <View className='w-[70px] h-[70px] relative rounded-lg overflow-hidden border-2 border-white'>
                                <Image
                                    source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                                    className='object-cover w-full h-full'
                                />
                                <View className="absolute top-0 left-0 h-full w-full bg-blue-500/50 items-center justify-center">
                                    <Text className='text-white font-semibold text-lg'>+3</Text>
                                </View>
                            </View>
                        </Link>
                    </View>
                </View>
                <View className="-mt-8 rounded-t-3xl bg-white px-4 pt-2">
                    <View className="-mx-3">
                        <View className="px-4 mt-6">
                            <View className='mb-4'>
                                <Text className="font-bold text-xl text-blue-900" numberOfLines={1}>Splendide appartement</Text>
                                <View className='flex-row items-center space-x-4 mt-2'>
                                    <View className='rounded-md px-3 pt-1 pb-1.5 bg-blue-500'>
                                        <Text className='text-white'>Appartemment</Text>
                                    </View>
                                    <View className='flex-row items-center space-x-1'>
                                        <Ionicons name='star' color={"orange"} size={16} />
                                        <Text className='font-semibold'>4.5</Text>
                                        <Text className='pl-0.5 font-semibold'>(14 Avis)</Text>
                                    </View>
                                </View>
                            </View>
                            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} className="flex-row -m-4">
                                <View className="h-24 w-32 rounded-2xl bg-white items-center justify-center mx-2 mt-6 mb-12 ml-4" style={InputShadow}>
                                    <Ionicons name='bed-outline' color={"#3b82f6"} size={32} />
                                    <Text className="font-bold text-sm">2 chambres</Text>
                                </View>
                                <View className="h-24 w-32 rounded-2xl bg-white items-center justify-center mx-2 mt-6 mb-12" style={InputShadow}>
                                    <Ionicons name='bed-outline' color={"#3b82f6"} size={32} />
                                    <Text className="font-bold text-sm">2 chambres</Text>
                                </View>
                                <View className="h-24 w-32 rounded-2xl bg-white items-center justify-center mx-2 mt-6 mb-12" style={InputShadow}>
                                    <Ionicons name='bed-outline' color={"#3b82f6"} size={32} />
                                    <Text className="font-bold text-sm">Vendre</Text>
                                </View>
                            </ScrollView>
                        </View>
                        <View className='px-4'>
                            <Text className='text-lg font-bold text-blue-900' numberOfLines={1}>Description</Text>
                            <Text className='mt-1' numberOfLines={showFullDesc ? undefined : 4}>
                                Splendide appartement situ  au centre de la ville, il offre une vue magnifique sur le parc. 
                                L'appartement est enti rement équipé et meublé, il comprend 2 chambres, 1 salle de bain, 1 cuisine équipée, 
                                1 salon, 1 chambre de service, 1 buanderie et un balcon. L'appartement a  t  r nov  en 2020, il est donc tout  
                                équipé des dernières technologies. Il est g  par un ascenseur et poss de un garage privé pour 1 voiture.
                            </Text>
                            <TouchableOpacity onPress={() => setShowFullDesc(!showFullDesc)}>
                                <Text className='text-blue-500 underline text-sm mt-1'>{showFullDesc ? 'Voir moins' : 'Voir plus'}</Text>
                            </TouchableOpacity>
                        </View>
                        <View className='px-4 pt-6'>
                            <Text className='text-lg font-bold text-blue-900' numberOfLines={1}>Bien plus</Text>
                            <View className="flex-row flex-wrap space-y-4 items-center mt-3">
                                <View className='w-1/4 justify-center items-center space-x-1'>
                                    <View className='h-14 w-14 bg-blue-500/20 rounded-full items-center justify-center'>
                                        <Ionicons name='podium' color={"#3b82f6"} size={26} />
                                    </View>
                                    <Text className='text-sm font-semibold mt-1' numberOfLines={1}>Chambre visiteur</Text>
                                </View>
                                <View className='w-1/4 justify-center items-center space-x-1'>
                                    <View className='h-14 w-14 bg-blue-500/20 rounded-full items-center justify-center'>
                                        <Ionicons name='car' color={"#3b82f6"} size={26} />
                                    </View>
                                    <Text className='text-sm font-semibold mt-1' numberOfLines={1}>Garage</Text>
                                </View>
                                <View className='w-1/4 justify-center items-center space-x-1'>
                                    <View className='h-14 w-14 bg-blue-500/20 rounded-full items-center justify-center'>
                                        <Ionicons name='wifi' color={"#3b82f6"} size={26} />
                                    </View>
                                    <Text className='text-sm font-semibold mt-1' numberOfLines={1}>Wifi</Text>
                                </View>
                                <View className='w-1/4 justify-center items-center space-x-1'>
                                    <View className='h-14 w-14 bg-blue-500/20 rounded-full items-center justify-center'>
                                        <Ionicons name='desktop' color={"#3b82f6"} size={26} />
                                    </View>
                                    <Text className='text-sm font-semibold mt-1' numberOfLines={1}>Ordinateur</Text>
                                </View>
                                <View className='w-1/4 justify-center items-center space-x-1'>
                                    <View className='h-14 w-14 bg-blue-500/20 rounded-full items-center justify-center'>
                                        <Ionicons name='podium' color={"#3b82f6"} size={26} />
                                    </View>
                                    <Text className='text-sm font-semibold mt-1' numberOfLines={1}>Chambre visiteur</Text>
                                </View>
                                <View className='w-1/4 justify-center items-center space-x-1'>
                                    <View className='h-14 w-14 bg-blue-500/20 rounded-full items-center justify-center'>
                                        <Ionicons name='car' color={"#3b82f6"} size={26} />
                                    </View>
                                    <Text className='text-sm font-semibold mt-1' numberOfLines={1}>Garage</Text>
                                </View>
                                <View className='w-1/4 justify-center items-center space-x-1'>
                                    <View className='h-14 w-14 bg-blue-500/20 rounded-full items-center justify-center'>
                                        <Ionicons name='wifi' color={"#3b82f6"} size={26} />
                                    </View>
                                    <Text className='text-sm font-semibold mt-1' numberOfLines={1}>Wifi</Text>
                                </View>
                                <View className='w-1/4 justify-center items-center space-x-1'>
                                    <View className='h-14 w-14 bg-blue-500/20 rounded-full items-center justify-center'>
                                        <Ionicons name='desktop' color={"#3b82f6"} size={26} />
                                    </View>
                                    <Text className='text-sm font-semibold mt-1' numberOfLines={1}>Ordinateur</Text>
                                </View>
                            </View>
                        </View>
                        <View className='pt-6 px-4'>
                            <View className='flex-row justify-between items-center'>
                                <Text className='text-lg font-bold text-blue-900' numberOfLines={1}>Vos avis</Text>
                                <Text className='text-blue-500 underline' numberOfLines={1}>Tout voir</Text>
                            </View>
                            <View className='flex-row items-center space-x-1'>
                                <Ionicons name='star' color={"orange"} size={16} />
                                <Text className='font-semibold'>4.5</Text>
                                <Text className='pl-0.5 font-semibold'>(14 Avis)</Text>
                            </View>
                        </View>
                        <View className='pt-6 px-4'>
                            <Text className='text-lg font-bold text-blue-900' numberOfLines={1}>Localisation</Text>
                            <View className="flex-row items-center mt-2">
                                <View className='flex-row items-center space-x-1 -ml-1'>
                                    <Ionicons name='location-outline' color={"#3b82f6"} size={20} />
                                    <Text className='text-gray-600' numberOfLines={1}>Moungali, Brazzaville Congo...</Text>
                                </View>
                            </View>
                            <View className='h-52 w-full bg-blue-500/25 rounded-lg mt-3'></View>
                        </View>
                    </View>
                </View>
                <View className='h-28' />
            </ScrollView>
            <View
                style={{
                    height: 80,
                    position: "absolute",
                    bottom: 16,
                    left: 16,
                    right: 16,
                    borderRadius:16,
                    backgroundColor: "white",
                    shadowColor: 'rgb(59, 130, 246)',
                    shadowOffset: {
                        width: 0,
                        height: 1,
                    },
                    shadowOpacity: 0.2,
                    shadowRadius: 1.41,

                    elevation: 2,
                }}
            >
                <View className="rounded-2xl overflow-hidden">
                    <Image
                        source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                        className='object-cover w-full h-full'
                    />
                    <View className='absolute top-0 left-0 bg-blue-500/50 w-full h-full rounded-2xl flex-row justify-between space-x-2 items-center py-3 px-6'>
                        <View className='flex-1'>
                            <Text className='font-semibold text-white underline text-2xl'>25 000,00</Text>
                            <Text className='font-semibold text-white text-sm'>Francs FCFA par jour</Text>
                        </View>
                        <TouchableOpacity onPress={() => {}} className=''>
                            <Ionicons name='call' color={"#FFF"} size={30} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}
