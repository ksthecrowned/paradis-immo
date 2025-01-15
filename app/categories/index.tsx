import { Image, View, Text, TouchableOpacity, StatusBar } from 'react-native';
import React, { useContext, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, TextInput } from 'react-native-gesture-handler';
import FeaturedProperties from '@/components/home/FeaturedProperties';
import SearchFilters from '@/components/common/SearchFilters';
import { cardShadow } from '@/constants/shadows';
import { Link, Stack } from 'expo-router';
import PropertiesCategoryCard from '@/components/cards/PropertiesCategoryCard';
import ParadiScrollView from '@/components/layout/ParadiScrollView';
import SecondaryHeader from '@/components/layout/SecondaryHeader';

export default function CategoriesScreen() {
  return (
    <>
      <Stack.Screen 
        options={{
          header: (props) => (
            <SecondaryHeader title='Catégories de propriétés' />
          ),
          animation: 'fade',
        }}
      />
      <ParadiScrollView
        handleScroll={() => {}}
      >
        <View className="p-4 pb-6">
          <View>
            <Text className="font-bold text-xl text-blue-900">Toutes nos categories</Text>
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
            <View className='w-1/2'>
              <PropertiesCategoryCard />
            </View>
            <View className='w-1/2'>
              <PropertiesCategoryCard />
            </View>
          </View>
        </View>
      </ParadiScrollView>
    </>
  );
}
