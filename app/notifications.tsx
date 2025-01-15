import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { ScrollView, StatusBar, Text, View, TouchableOpacity } from 'react-native';

export default function NotificationScreen() {
  return (
    <>
        <Stack.Screen 
            options={{
                headerTitle: 'Notifications',
                presentation: 'modal',
                animation: 'fade',
            }} 
        />
        <StatusBar
            backgroundColor="transparent"
            translucent={true}
            barStyle={'dark-content'}
        />
        <ScrollView className='flex-1' showsVerticalScrollIndicator={false}>
            <View className="rounded-t-3xl px-4 pt-6">
                <View className=''>
                    <View className='mb-2'>
                        <Text className="font-bold text-lg text-blue-900">Aujoud'hui</Text>
                    </View>
                    <View className='gap-3 divide-y divide-blue-500/10 pb-6'>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-green-500 rounded-full items-center justify-center">
                                <Ionicons name='checkmark-circle-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Bienvenue</Text>
                                <Text className='text-xs'>Bienvenue sur Paradis Immobilier, votre plateforme de recherche de biens immobiliers en ligne. Nous sommes ravis de vous avoir parmi nous !</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-red-500 rounded-full items-center justify-center">
                                <Ionicons name='close-circle-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Propriété indisponible</Text>
                                <Text className='text-xs'>La propriété que vous avez visitée est actuellement indisponible. Veuillez essayer plus tard.</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
                <View className=''>
                    <View className='mb-2'>
                        <Text className="font-bold text-lg text-blue-900">Plus anciens</Text>
                    </View>
                    <View className='gap-3 divide-y divide-blue-500/10 pb-6'>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-green-500 rounded-full items-center justify-center">
                                <Ionicons name='checkmark-circle-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Bienvenue</Text>
                                <Text className='text-xs'>Bienvenue sur Paradis Immobilier, votre plateforme de recherche de biens immobiliers en ligne. Nous sommes ravis de vous avoir parmi nous !</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-red-500 rounded-full items-center justify-center">
                                <Ionicons name='close-circle-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Propriété indisponible</Text>
                                <Text className='text-xs'>La propriété que vous avez visitée est actuellement indisponible. Veuillez essayer plus tard.</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-yellow-400 rounded-full items-center justify-center">
                                <Ionicons name='time-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Nouvelle propriété</Text>
                                <Text className='text-xs'>Une nouvelle propriété sera bientot disponible</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-yellow-400 rounded-full items-center justify-center">
                                <Ionicons name='time-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Nouvelle propriété</Text>
                                <Text className='text-xs'>Une nouvelle propriété sera bientot disponible</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-red-500 rounded-full items-center justify-center">
                                <Ionicons name='close-circle-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Propriété indisponible</Text>
                                <Text className='text-xs'>La propriété que vous avez visitée est actuellement indisponible. Veuillez essayer plus tard.</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-green-500 rounded-full items-center justify-center">
                                <Ionicons name='checkmark-circle-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Propriété disponible</Text>
                                <Text className='text-xs'>La propriété que vous avez visitée est actuellement disponible. N'hésitez pas à nous contacter pour obtenir plus d'informations ou pour planifier une visite.</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-red-500 rounded-full items-center justify-center">
                                <Ionicons name='close-circle-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Propriété indisponible</Text>
                                <Text className='text-xs'>La propriété que vous avez visitée est actuellement indisponible. Veuillez essayer plus tard.</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-yellow-400 rounded-full items-center justify-center">
                                <Ionicons name='time-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Nouvelle propriété</Text>
                                <Text className='text-xs'>Une nouvelle propriété sera bientot disponible</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-yellow-400 rounded-full items-center justify-center">
                                <Ionicons name='time-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Nouvelle propriété</Text>
                                <Text className='text-xs'>Une nouvelle propriété sera bientot disponible</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-red-500 rounded-full items-center justify-center">
                                <Ionicons name='close-circle-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Propriété indisponible</Text>
                                <Text className='text-xs'>La propriété que vous avez visitée est actuellement indisponible. Veuillez essayer plus tard.</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row space-x-1.5 pt-3">
                            <View className="h-12 w-12 bg-green-500 rounded-full items-center justify-center">
                                <Ionicons name='checkmark-circle-outline' size={24} color={"#FFF"} />
                            </View>
                            <View className="flex-1">
                                <Text className='text-lg'>Propriété disponible</Text>
                                <Text className='text-xs'>La propriété que vous avez visitée est actuellement disponible. N'hésitez pas à nous contacter pour obtenir plus d'informations ou pour planifier une visite.</Text>
                                <Text className='text-xs text-gray-400 mt-1'>Il y a 2 heures</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ScrollView>
    </>
  );
}
