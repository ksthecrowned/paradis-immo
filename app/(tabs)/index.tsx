import { Image, View, Text, TouchableOpacity, StatusBar, TextInput } from 'react-native';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView } from 'react-native-gesture-handler';
import { cardShadow } from '@/constants/shadows';
import { Link, Stack, router } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';
import PrimaryHeader from '@/components/layout/PrimaryHeader';
import ParadiScrollView from '@/components/layout/ParadiScrollView';
import PropertySecondaryCard from '@/components/cards/PropertySecondaryCard';
import PropertiesCategoryCard from '@/components/cards/PropertiesCategoryCard';

export default function HomeScreen() {
  const scrollY = useSharedValue(0);

  const handleScroll = (event: any) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };
  return (
    <>
      <Stack.Screen 
        options={{
          header: (props) => (
            <PrimaryHeader title='' smallHeader={false} scrollY={scrollY}>
              <Text className="text-4xl font-black text-white text-center">Bienvenue sur Paradis Immobilier.</Text>
              <Text className="text-white font-medium mt-2 text-sm text-center">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Omnis, quis fugiat consequuntur architecto, dignissimos placeat perspiciatis amet quod quisquam nulla magni impedit laborum.</Text>
              <View className="pt-6 justify-between flex-row gap-2 relative">
                <TextInput
                  placeholder="Search for a location"
                  editable
                  value=""
                  className="flex-1 rounded-lg bg-white py-2 pl-11 pr-5"
                />
                <View className="absolute top-8 left-2">
                  <Ionicons color='#3b82f6' name='search' size={30} />
                </View>
                <TouchableOpacity 
                  onPress={() => {router.push('../modals/search-filters')}} 
                  className="h-12 w-12 bg-white rounded-lg items-center justify-center"
                >
                  <Image source={require('@/assets/images/equalizer.png')} className="w-7 h-7"></Image>
                </TouchableOpacity>
              </View>
            </PrimaryHeader>
          ),
        }}
      />
      <View className='flex-1'>
        <ParadiScrollView 
          handleScroll={handleScroll}
        >
          <View className="px-4">
            <View className='mb-4'>
                <Text className="font-bold text-xl text-blue-900">L'immobilier</Text>
                <Text className="text-gray-600">Que souhaitez-vous faire ?</Text>
            </View>
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} className="flex-row -m-4">
                <View className="h-32 w-32 rounded-2xl bg-white items-center justify-center mx-2 mt-6 mb-12 ml-4" style={cardShadow}>
                    <Image source={require('@/assets/images/house-for-sale.png')} className="h-12 w-12 mb-2 object-cover" ></Image>
                    <Text className="font-bold uppercase">Louer</Text>
                </View>
                <View className="h-32 w-32 rounded-2xl bg-white items-center justify-center mx-2 mt-6 mb-12" style={cardShadow}>
                    <Image source={require('@/assets/images/buy-property.png')} className="h-12 w-12 mb-2 object-cover" ></Image>
                    <Text className="font-bold uppercase">Acheter</Text>
                </View>
                <View className="h-32 w-32 rounded-2xl bg-white items-center justify-center mx-2 mt-6 mb-12" style={cardShadow}>
                    <Image source={require('@/assets/images/buildingIcon.png')} className="h-12 w-12 mb-2 object-cover" ></Image>
                    <Text className="font-bold uppercase">Vendre</Text>
                </View>
            </ScrollView>
        </View>
        <View className="px-4 pb-6">
            <View>
                <Text className="font-bold text-xl text-blue-900">Gategories</Text>
                <Text className="text-gray-600">Explorez toutes nos catégories de biens immobiliers.</Text>
            </View>
            <View className="flex-row flex-wrap my-3 -mx-2">
              <View className='w-1/2'>
                <PropertiesCategoryCard />
              </View>
              <View className='w-1/2'>
                <PropertiesCategoryCard />
              </View>
              <View className='w-1/2'>
                <PropertiesCategoryCard />
              </View>
              <View className='w-1/2'>
                <PropertiesCategoryCard />
              </View>
            </View>
            <View className='justify-center items-center mt-2'>
              <Link href={'/categories'}>
                <Text className='text-blue-500'>Afficher plus de categories</Text>
              </Link>
            </View>
        </View>

          <View className='p-5 mt-4'>
            <View>
              <Text className="font-bold text-xl text-blue-900">Recommandations</Text>
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
              <View>
                <PropertySecondaryCard />
              </View>
            </View>
            <View className="h-20"></View>
          </View>
        </ParadiScrollView>
      </View>
    </>
  );
}
