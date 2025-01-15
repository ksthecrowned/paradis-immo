import PropertyPrimaryCard from '@/components/cards/PropertyPrimaryCard';
import PropertySecondaryCard from '@/components/cards/PropertySecondaryCard';
import ParadiScrollView from '@/components/layout/ParadiScrollView';
import SecondaryHeader from '@/components/layout/SecondaryHeader';
import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

export default function SingleCategoryScreen() {
  const { id } = useLocalSearchParams()
  console.log('id', id);

  const scrollY = useSharedValue(0);
  
    const handleScroll = (event: any) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    };
  return (
    <>
      <Stack.Screen 
        options={{
          header: (props) => (
            <SecondaryHeader smallHeader scrollY={scrollY} title='Nom de la categorie'>
                <Text>
                    Nom de la categorie
                </Text>
            </SecondaryHeader>
          ),
          animation: 'fade',
        }}
      />
      <ParadiScrollView
        handleScroll={handleScroll}
      >
        <View className="bg-white p-4">
          <View className=''>
            <View>
              <Text className="font-bold text-xl text-blue-900">Notre sélection d'appartements</Text>
              <Text className="text-gray-600">Nos appartements de rêves</Text>
            </View>
            <View className='pt-4 gap-4'>
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
          </View>
          <View className='my-6'>
            <View>
              <Text className="font-bold text-xl text-blue-900">Près de chez vous</Text>
              <Text className="text-gray-600">Nos appartements de rêves</Text>
            </View>
            <View className='pt-4 gap-4'>
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
          </View>
        </View>
      </ParadiScrollView>
    </>
  );
}
