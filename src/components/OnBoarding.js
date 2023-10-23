import { View, Text, TouchableOpacity, FlatList, useWindowDimensions, SafeAreaView, Animated } from 'react-native'
import { useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import OnBoardingPaginator from './OnBoardingPaginator'
import OnBoardingNextBtn from './OnBoardingNextBtn'

const SLIDES = [
    {
        id: 1,
        title: "Quick & Easy Payments",
        color: "red",
    },
    {
        id: 2,
        title: "Smart Point of Sale",
        color: "red",
    },
    {
        id: 3,
        title: "Instant Notifications",
        color: "red",
    },
    {
        id: 4,
        title: "Customize Everything",
        color: "red",
    }
]

const OnBoarding = () => {
    const [currentIndex, setCurrentIndex] = useState(0)
    const scrollX = useRef(new Animated.Value(0)).current
    const slidesRef = useRef(null)

    const viewableItemsChanged = useRef(({ viewableItems }) => {
        setCurrentIndex(viewableItems[0].index);
    }).current

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current

    const scrollTo = async () => {
        if(currentIndex < SLIDES.length - 1) {
            slidesRef.current.scrollToIndex({ index: currentIndex + 1 })
        } else {
            try {
                await AsyncStorage.setItem('@viewedOnboarding', 'true')
            } catch (error) {
                console.log("err", error)
            }
        }
    }
    return (
        <View className="flex-1 justify-center items-center">
            <View className="h-full">
                <FlatList 
                    data={SLIDES} 
                    renderItem={({ item }) => <OnBoardingItem item={item} />} 
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    pagingEnabled
                    bounces={false}
                    keyExtractor={(item) => item.id}
                    onScroll={Animated.event([{nativeEvent: {contentOffset: {x: scrollX}}}], {
                        useNativeDriver: false,
                    })}
                    scrollEventThrottle={32}
                    onViewableItemsChanged={viewableItemsChanged}
                    viewabilityConfig={viewConfig}
                    ref={slidesRef}
                />
            </View>
            <OnBoardingPaginator data={SLIDES} scrollX={scrollX} />
            {/* <OnBoardingNextBtn scrollTo={scrollTo} percentage={(currentIndex + 1) * (100 / SLIDES.length)} /> */}
        </View>
    )
}

const OnBoardingItem = ({ item }) => {
    const { width, height } = useWindowDimensions()
    return (
        <View className={`items-center justify-center bg-${item.color}-600`} style={{width: width, height: height}}>
            <Text className="text-xl text-white">{item.title}</Text>
        </View>
    )
}

export default OnBoarding