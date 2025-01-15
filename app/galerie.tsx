import React from 'react';

import PagerView from 'react-native-pager-view';
import { ScrollView } from 'react-native-gesture-handler';
import { View } from 'react-native-animatable';
import { Image } from 'react-native';

export default function NotificationScreen() {
    return (
        <ScrollView className='flex-1 px-5 pt-3 bg-white' showsVerticalScrollIndicator={false}>
            <View className='gap-3 divide-y divide-blue-500/10 pb-6'>
                <PagerView
                    testID={'pager-view'}
                    initialPage={0}
                    className={'flex-1 h-[400px] mt-3'}
                >
                    <View className='w-full h-full overflow-hidden relative'>
                        <Image
                            source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                            className='object-cover w-full h-full'
                        />
                    </View>
                    <View className='w-full h-full overflow-hidden relative'>
                        <Image
                            source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')}
                            className='object-cover w-full h-full'
                        />
                    </View>
                </PagerView>
            </View>
        </ScrollView>
    );
}
