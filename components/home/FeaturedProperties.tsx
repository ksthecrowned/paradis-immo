import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Image } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { useHandler, useEvent } from 'react-native-reanimated';
import { Link } from 'expo-router';

const AnimatedPager = Animated.createAnimatedComponent(PagerView);

export function usePagerScrollHandler(handlers: any, dependencies?: any) {
  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies);
  const subscribeForEvents = ['onPageScroll'];

  return useEvent<any>(
    (event) => {
      'worklet';
      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith('onPageScroll')) {
        onPageScroll(event, context);
      }
    },
    subscribeForEvents,
    doDependenciesDiffer
  );
}

export default function FeaturedProperties() {
  const handler = usePagerScrollHandler({
    onPageScroll: (e: any) => {
      'worklet';
      console.log(e.offset, e.position);
    },
  });

  return (
    <View className='flex-1'>
      <AnimatedPager
        testID={'pager-view'}
        initialPage={0}
        onPageScroll={handler}
        className={'flex-1 h-[400px] mt-3'}
      >
        <View className='w-full h-full overflow-hidden rounded-2xl relative'>
          <Image
              source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
              className='object-cover w-full h-full'
          />
          <View className="absolute top-0 left-0 w-full h-full justify-end p-6">
              <View className='bg-white p-4 pl-3 rounded-2xl gap-1'>
                <Link href={"/properties/1"}>
                  <Text className='pl-1 text-xl font-bold' numberOfLines={1}>Splendide appartement</Text>
                </Link>
                <View className='flex-row items-center space-x-1 mt-0.5'>
                    <Ionicons name='location-outline' color={"#3b82f6"} size={20} />
                    <Text className='text-gray-600' numberOfLines={1}>Diata, Brazzaville Congo...</Text>
                </View>
                <Text className='pl-1 text-base'>15 000 FCFA / jour</Text>
              </View>
          </View>
        </View>
        <View className='w-full h-full overflow-hidden rounded-2xl relative'>
          <Image
              source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
              className='object-cover w-full h-full'
          />
          <View className="absolute top-0 left-0 w-full h-full justify-end p-6">
            <View className='bg-white p-4 pl-3 rounded-2xl gap-1'>
              <Text className='pl-1 text-xl font-bold' numberOfLines={1}>Magnifique appartement</Text>
              <View className='flex-row items-center space-x-1 mt-0.5'>
                  <Ionicons name='location-outline' color={"#3b82f6"} size={20} />
                  <Text className='text-gray-600' numberOfLines={1}>Moungali, Brazzaville Congo...</Text>
              </View>
              <Text className='pl-1 text-base'>35 000 FCFA / jour</Text>
            </View>
          </View>
        </View>
      </AnimatedPager>
    </View>
  );
}