import { View, Text, TouchableOpacity, FlatList, useWindowDimensions, 
    SafeAreaView, Animated, StatusBar, Image
} from 'react-native'
import { useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'

import OnBoardingPaginator from './OnBoardingPaginator'
import OnBoardingNextBtn from './OnBoardingNextBtn'
import house from '../../assets/images/house.jpg'
import realEstateHand from '../../assets/images/real-estate-hand.png'

const SLIDES = [
    {
        id: 1,
        title: "Paradis Immobilier",
        desc: "L'immobilier comme vous ne l'avez jamais vu.",
    },
    {
        id: 2,
        title: "Bienvenue sur Paradis Immobilier",
        desc: "Nous sommes ravis de vous aider à trouver votre prochain chez-vous. Commençons par quelques étapes faciles.",
    },
    {
        id: 3,
        title: "Explorez les biens immobiliers",
        desc: "Parcourez les propriétés, filtrez par type, emplacement et prix. Trouvez des options qui correspondent à vos critères.",
    },
    {
        id: 4,
        title: "Inscrivez-vous pour enregistrer vos favoris",
        desc: "Pour conserver vos biens préférés, créez un compte. Cela vous permettra également de recevoir des mises à jour sur les propriétés qui vous intéressent.",
    }
]

const OnBoarding = ({ setViewedOnBoarding }) => {
    const [currentIndex, setCurrentIndex] = useState(0)
    const scrollX = useRef(new Animated.Value(0)).current
    const slidesRef = useRef(null)

    const viewableItemsChanged = useRef(({ viewableItems }) => {
        setCurrentIndex(viewableItems[0].index);
    }).current

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current

    const handleFinish = async () => {
        try {
            await AsyncStorage.setItem('@viewedOnBoarding', 'true')
            setViewedOnBoarding(true)
        } catch (e) {
            // saving error
        }
    }

    // const scrollTo = async () => {
    //     if(currentIndex < SLIDES.length - 1) {
    //         slidesRef.current.scrollToIndex({ index: currentIndex + 1 })
    //     } else {
    //         try {
    //             await AsyncStorage.setItem('@viewedOnboarding', 'true')
    //         } catch (error) {
    //             console.log("err", error)
    //         }
    //     }
    // }
    return (
        <View className="flex-1 justify-center items-center relative">
            <StatusBar
                backgroundColor="transparent"
                translucent={true}
                barStyle={'dark-content'}
            />
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
            {
                currentIndex === 3
                ? (
                    <View className="w-full p-6 absolute bottom-16">
                        <TouchableOpacity  onPress={() => handleFinish()} className="w-full p-5 bg-blue-500 rounded-lg">
                            <Text className="text-white text-center text-base">
                                Allons-y ! 
                            </Text>
                        </TouchableOpacity>
                    </View>
                )
                : <OnBoardingPaginator data={SLIDES} scrollX={scrollX} />
            }
            {/* <OnBoardingNextBtn scrollTo={scrollTo} percentage={(currentIndex + 1) * (100 / SLIDES.length)} /> */}
        </View>
    )
}

const OnBoardingItem = ({ item }) => {
    const { width, height } = useWindowDimensions()
    return (
        <View className={`items-center justify-center flex-1 relative`} style={{width: width}}>
            {
                item.id === 1
                ? (
                    <>
                        <Image source={house} className="flex-1" style={{width: width}} />
                        <LinearGradient className="absolute h-full w-full p-6 justify-end pb-32 items-center" colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}>
                            <Text className="text-4xl font-bold text-center text-white">{item.title}</Text>
                            <Text className="text-base p-2 text-center text-white">
                                {item.desc}
                            </Text>
                        </LinearGradient>
                    </>
                )
                : (
                    <>
                        <Image source={realEstateHand} className="w-52 h-52" />
                        <View className="p-6 space-y-4">
                            <Text className="text-3xl font-bold text-center text-gray-800">{item.title}</Text>
                            <Text className="text-base text-center">
                                {item.desc}
                            </Text>
                        </View>
                    </>
                )
            }
        </View>
    )
}

export default OnBoarding