import ParadisRoundedPath from '@/components/common/ParadisRoundedPath';
import FeaturedProperties from '@/components/home/FeaturedProperties';
import { cardShadow } from '@/constants/shadows';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StatusBar, Text, TextInput } from 'react-native';
import { View } from 'react-native-animatable';
import { TouchableOpacity } from 'react-native-gesture-handler';

export default function SearchScreen() {
  return (
    <>
        <Stack.Screen 
            options={{
                header: (props) => (
                    <View className={"h-fit bg-transparent"}>
                        <View className="bg-blue-500 relative overflow-hidden pb-5 py-10">
                            <View className="px-4 py-2 justify-between flex-row gap-2 relative">
                                <TextInput
                                    placeholder="Search for a location"
                                    editable
                                    value=""
                                    cursorColor="#3b82f6"
                                    className="flex-1 rounded-lg bg-white py-3 pl-11 pr-5"
                                />
                                <View className="absolute top-5 left-6">
                                    <TouchableOpacity onPress={() => {
                                        router.back()
                                    }}>
                                        <Ionicons color='#3b82f6' name='arrow-back' size={30} />
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity 
                                    onPress={() => {
                                        router.dismiss(2)
                                        router.push('/modals/search-filters')
                                    }} 
                                    className="h-[51px] w-12 bg-white rounded-lg items-center justify-center relative"
                                >   
                                    <View className='absolute -top-2 -right-2 h-6 w-6 bg-red-600 rounded-full flex items-center justify-center'>
                                        <Text className='text-white text-center mb-0.5'>6</Text>
                                    </View>
                                    <Image source={require('@/assets/images/equalizer.png')} className="w-7 h-7"></Image>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className="transform rotate-180">
                            <ParadisRoundedPath fill="white" height={35} />
                        </View>
                    </View>
                    
                ),
            }}
        />
        <ScrollView className='flex-1 bg-white' showsVerticalScrollIndicator={false}>
            <View className='px-4'>
                <View className='flex-row justify-between'>
                    <View>
                        <Text className="font-bold text-xl text-blue-900">Résultats de recherche</Text>
                    </View>
                </View>
                <View className='pt-4 gap-4'>
                    <View className='flex-row rounded-2xl border border-blue-500/10 overflow-hidden bg-white' style={cardShadow}>
                        <View className='w-32 h-32 relative overflow-hidden'>
                            <Image
                                source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                                className='object-cover w-32 h-32'
                            />
                            <View className="absolute h-full w-full bg-black/10"></View>
                        </View>
                        <View className='flex-1 p-4 gap-0.5'>
                            <Text className='text-base font-medium text-blue-500' numberOfLines={1}>Splendide appartement</Text>
                            <Text className='text-sm' numberOfLines={1}>Diata, Brazzaville Congo</Text>
                            <Text className='text-sm' numberOfLines={1}>VIC 3473</Text>
                            <View className="flex-row items-center space-x-4 mt-1 -ml-1">
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='bed-outline' size={17} />
                                    <Text className='text-sm font-medium'>2</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='car-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='share-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <View className='flex-row rounded-2xl border border-blue-500/10 overflow-hidden bg-white' style={cardShadow}>
                        <View className='w-32 h-32 relative overflow-hidden'>
                            <Image
                                source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                                className='object-cover w-32 h-32'
                            />
                            <View className="absolute h-full w-full bg-black/10"></View>
                        </View>
                        <View className='flex-1 p-4 gap-0.5'>
                            <Text className='text-base font-medium text-blue-500' numberOfLines={1}>Splendide appartement</Text>
                            <Text className='text-sm' numberOfLines={1}>Diata, Brazzaville Congo</Text>
                            <Text className='text-sm' numberOfLines={1}>VIC 3473</Text>
                            <View className="flex-row items-center space-x-4 mt-1 -ml-1">
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='bed-outline' size={17} />
                                    <Text className='text-sm font-medium'>2</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='car-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='share-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <View className='flex-row rounded-2xl border border-blue-500/10 overflow-hidden bg-white' style={cardShadow}>
                        <View className='w-32 h-32 relative overflow-hidden'>
                            <Image
                                source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                                className='object-cover w-32 h-32'
                            />
                            <View className="absolute h-full w-full bg-black/10"></View>
                        </View>
                        <View className='flex-1 p-4 gap-0.5'>
                            <Text className='text-base font-medium text-blue-500' numberOfLines={1}>Splendide appartement</Text>
                            <Text className='text-sm' numberOfLines={1}>Diata, Brazzaville Congo</Text>
                            <Text className='text-sm' numberOfLines={1}>VIC 3473</Text>
                            <View className="flex-row items-center space-x-4 mt-1 -ml-1">
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='bed-outline' size={17} />
                                    <Text className='text-sm font-medium'>2</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='car-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='share-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <View className='flex-row rounded-2xl border border-blue-500/10 overflow-hidden bg-white' style={cardShadow}>
                        <View className='w-32 h-32 relative overflow-hidden'>
                            <Image
                                source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                                className='object-cover w-32 h-32'
                            />
                            <View className="absolute h-full w-full bg-black/10"></View>
                        </View>
                        <View className='flex-1 p-4 gap-0.5'>
                            <Text className='text-base font-medium text-blue-500' numberOfLines={1}>Splendide appartement</Text>
                            <Text className='text-sm' numberOfLines={1}>Diata, Brazzaville Congo</Text>
                            <Text className='text-sm' numberOfLines={1}>VIC 3473</Text>
                            <View className="flex-row items-center space-x-4 mt-1 -ml-1">
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='bed-outline' size={17} />
                                    <Text className='text-sm font-medium'>2</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='car-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='share-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <View className='flex-row rounded-2xl border border-blue-500/10 overflow-hidden bg-white' style={cardShadow}>
                        <View className='w-32 h-32 relative overflow-hidden'>
                            <Image
                                source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                                className='object-cover w-32 h-32'
                            />
                            <View className="absolute h-full w-full bg-black/10"></View>
                        </View>
                        <View className='flex-1 p-4 gap-0.5'>
                            <Text className='text-base font-medium text-blue-500' numberOfLines={1}>Splendide appartement</Text>
                            <Text className='text-sm' numberOfLines={1}>Diata, Brazzaville Congo</Text>
                            <Text className='text-sm' numberOfLines={1}>VIC 3473</Text>
                            <View className="flex-row items-center space-x-4 mt-1 -ml-1">
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='bed-outline' size={17} />
                                    <Text className='text-sm font-medium'>2</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='car-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='share-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <View className='flex-row rounded-2xl border border-blue-500/10 overflow-hidden bg-white' style={cardShadow}>
                        <View className='w-32 h-32 relative overflow-hidden'>
                            <Image
                                source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                                className='object-cover w-32 h-32'
                            />
                            <View className="absolute h-full w-full bg-black/10"></View>
                        </View>
                        <View className='flex-1 p-4 gap-0.5'>
                            <Text className='text-base font-medium text-blue-500' numberOfLines={1}>Splendide appartement</Text>
                            <Text className='text-sm' numberOfLines={1}>Diata, Brazzaville Congo</Text>
                            <Text className='text-sm' numberOfLines={1}>VIC 3473</Text>
                            <View className="flex-row items-center space-x-4 mt-1 -ml-1">
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='bed-outline' size={17} />
                                    <Text className='text-sm font-medium'>2</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='car-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                                <View className='flex-row items-center space-x-1'>
                                    <Ionicons name='share-outline' size={17} />
                                    <Text className='text-sm font-medium'>1</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            <View className="h-24" />
        </ScrollView>
    </>
  );
}
