import PropertyPrimaryCard from '@/components/cards/PropertyPrimaryCard';
import PropertySecondaryCard from '@/components/cards/PropertySecondaryCard';
import FeaturedProperties from '@/components/home/FeaturedProperties';
import ParadiScrollView from '@/components/layout/ParadiScrollView';
import PrimaryHeader from '@/components/layout/PrimaryHeader';
import { cardShadow } from '@/constants/shadows';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StatusBar, Text, TextInput } from 'react-native';
import { View } from 'react-native-animatable';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

export default function ExploreScreen() {
    const scrollY = useSharedValue(0);
    
    const handleScroll = (event: any) => {
        scrollY.value = event.nativeEvent.contentOffset.y;
    };
  return (
    <>
        <Stack.Screen 
            options={{
            header: (props) => (
                <PrimaryHeader smallHeader scrollY={scrollY} title='Explorer'>
                    <View className="relative">
                        <View className='flex items-center justify-center mb-1'>
                            <Ionicons name='compass' size={45} color='white'/>
                        </View>
                        <Text className="text-2xl font-black text-white text-center">Explorer Paradis Immo</Text>
                        <Text className="text-gray-100 text-center mt-1">Trouvez votre appartement/maison de rêve</Text>
                    </View>
                </PrimaryHeader>
            ),
            }}
        />
        <StatusBar barStyle={'default'} />
        <View className='flex-1 bg-white'>
            <ParadiScrollView
                handleScroll={handleScroll}
            >
                <View className='mb-4 px-4'>
                    <Text className="font-bold text-xl text-blue-900">Notre sélection d'appartements</Text>
                    <Text className="text-gray-600">Nos appartements de rêves</Text>
                </View>
                <View className='gap-4 px-4'>
                    <View>
                        <PropertyPrimaryCard />
                    </View>
                    <View>
                        <PropertyPrimaryCard />
                    </View>
                    <View>
                        <PropertyPrimaryCard />
                    </View>
                    <View>
                        <PropertyPrimaryCard />
                    </View>
                    <View>
                        <PropertyPrimaryCard />
                    </View>
                    <View>
                        <PropertyPrimaryCard />
                    </View>
                </View>

                <View className='mt-6 mb-4 px-4'>
                    <Text className="font-bold text-xl text-blue-900">Près de chez vous</Text>
                    <Text className="text-gray-600">Nos appartements de rêves</Text>
                </View>
                <View className='gap-4 px-4'>
                    <View>
                        <PropertySecondaryCard />
                    </View>
                    <View>
                        <PropertySecondaryCard />
                    </View>
                    <View>
                        <PropertySecondaryCard />
                    </View>
                </View>

                <View className="h-24" />
            </ParadiScrollView>
        </View>
    </>
  );
}
