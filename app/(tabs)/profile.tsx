import ParadiScrollView from '@/components/layout/ParadiScrollView';
import PrimaryHeader from '@/components/layout/PrimaryHeader';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StatusBar, Text, TextInput, Touchable } from 'react-native';
import { View } from 'react-native-animatable';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

export default function ProfileScreen() {
  const scrollY = useSharedValue(0);
  const handleScroll = (event: any) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };
  return (
    <>
    <Stack.Screen 
      options={{
      header: (props) => (
          <PrimaryHeader title='Profil' smallHeader scrollY={scrollY}>
            <View className="relative items-center justify-center">
              <View className='h-20 w-20 rounded-full bg-white justify-center items-center mb-2'>
                <Text className='text-blue-900 text-2xl font-bold'>KS</Text>
              </View>
              <Text className="text-2xl font-black text-white text-center">Kaiser D. Styve</Text>
              <Text className="text-gray-100 text-center mt-1">kaiserstyve2@gmail.com</Text>
            </View>
          </PrimaryHeader>
      ),
      }}
  />
  <StatusBar barStyle={'default'} />
    <View className='flex-1 bg-white'>
        <ScrollView
          // handleScroll={handleScroll}
        >
            <View className="-mt-8 rounded-t-3xl bg-white px-4 pt-8">
                <View className='gap-2'>
                  <TouchableOpacity className='flex-row justify-between items-center rounded-xl border border-blue-500/10 p-2'>
                    <View className='flex-row items-center space-x-2'>
                      <View className='h-12 w-12 rounded-lg bg-blue-500/20 items-center justify-center'>
                        <Ionicons name="person" size={22} color={"rgb(59, 130, 246)"} />
                      </View>
                      <Text className='text-base'>Modifier mes infirmations</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} />
                  </TouchableOpacity>
                  <TouchableOpacity className='flex-row justify-between items-center rounded-xl border border-blue-500/10 p-2'>
                    <View className='flex-row items-center space-x-2'>
                      <View className='h-12 w-12 rounded-lg bg-blue-500/20 items-center justify-center'>
                        <Ionicons name="person" size={22} color={"rgb(59, 130, 246)"} />
                      </View>
                      <Text className='text-base'>Modifier mes infirmations</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} />
                  </TouchableOpacity>
                  <TouchableOpacity className='flex-row justify-between items-center rounded-xl border border-blue-500/10 p-2'>
                    <View className='flex-row items-center space-x-2'>
                      <View className='h-12 w-12 rounded-lg bg-blue-500/20 items-center justify-center'>
                        <Ionicons name="person" size={22} color={"rgb(59, 130, 246)"} />
                      </View>
                      <Text className='text-base'>Modifier mes infirmations</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} />
                  </TouchableOpacity>
                  <TouchableOpacity className='flex-row justify-between items-center rounded-xl border border-blue-500/10 p-2'>
                    <View className='flex-row items-center space-x-2'>
                      <View className='h-12 w-12 rounded-lg bg-blue-500/20 items-center justify-center'>
                        <Ionicons name="settings" size={22} color={"rgb(59, 130, 246)"} />
                      </View>
                      <Text className='text-base'>Réglages</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} />
                  </TouchableOpacity>
                  <TouchableOpacity className='flex-row justify-between items-center rounded-xl border border-blue-500/10 p-2'>
                    <View className='flex-row items-center space-x-2'>
                      <View className='h-12 w-12 rounded-lg bg-blue-500/20 items-center justify-center'>
                        <Ionicons name="share-social" size={22} color={"rgb(59, 130, 246)"} />
                      </View>
                      <Text className='text-base'>Partager l'application</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} />
                  </TouchableOpacity>
                  <TouchableOpacity className='flex-row justify-between items-center rounded-xl border border-blue-500/10 p-2'>
                    <View className='flex-row items-center space-x-2'>
                      <View className='h-12 w-12 rounded-lg bg-blue-500/20 items-center justify-center'>
                        <Ionicons name="information-circle" size={22} color={"rgb(59, 130, 246)"} />
                      </View>
                      <Text className='text-base'>A propos</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} />
                  </TouchableOpacity>
                </View>
                <View className='items-center justify-center mt-8'>
                  <Text className='text-red-600 font-bold'>Se deconnecter</Text>
                </View>
                <View className="h-96" />
            </View>
        </ScrollView>
    </View>
    </>
  );
}
