import { View, Text, Image, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import PropertyScreen from '../../src/screens/PropertyScreen'

import location from '../../assets/icons/location.png'
import bed from '../../assets/icons/bed.png'
import home from '../../assets/icons/home.png'
import bathtub from '../../assets/icons/bathtub.png'

import property01 from '../../assets/images/property01.jpeg'
import property02 from '../../assets/images/property02.jpg'
import property03 from '../../assets/images/property03.jpg'

import { useNavigation } from '@react-navigation/native'
import { urlFor } from '../../sanity' 
import { getPropertyObject, formatToMoney } from '../utils/useFullFunctions'

const PropertyItem = ({ property }) => {
    const navigation = useNavigation()
    return (
        <View className="overflow-hidden rounded-2xl relative h-60 shadow-lg mt-3">
            <Image 
                source={{
                    uri: urlFor(property.image).url()
                }} 
                className="w-full rounded-xl h-72 object-cover" 
            />
            <LinearGradient className="absolute top-0 h-full w-full p-6 justify-end pr-12" colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}>
                <TouchableOpacity className=""
                    onPress={() => {
                        navigation.navigate('Root', {
                            screen: 'PropertyScreen',
                            params: { user: 'jane' }
                        })
                    }}
                >
                    <Text className="text-xl font-bold text-white">{property.name}</Text>
                </TouchableOpacity>
                <Text className="text-gray-300 text-lg font-bold mb-1">{formatToMoney(property.price)} FCFA</Text>
                <View className="flex-row space-x-1 items-center"> 
                    <Image source={location} className="w-5 h-5"></Image>
                    <Text className="text-white">à 1 de votre position</Text>
                </View>
            </LinearGradient>
            <View className="absolute top-6 left-6 bg-blue-500 rounded-lg py-2 px-4">
                <Text className="text-white font-bold">{getPropertyObject(property.object)}</Text>
            </View>
            <View className="absolute right-0 w-10 h-full bg-blue-500 rounded-tl-xl mt-10 items-center py-3 space-y-4">
                <View className="items-center border-b border-white pb-1">
                    <Image source={home} className="w-6 h-6"></Image>
                    <Text className="text-white font-bold">1</Text>
                </View>
                <View className="items-center border-b border-white pb-1">
                    <Image source={bathtub} className="w-6 h-6"></Image>
                    <Text className="text-white font-bold">1</Text>
                </View>
                <View className="items-center border-b border-transparent pb-1">
                    <Image source={bed} className="w-6 h-6"></Image>
                    <Text className="text-white font-bold">1</Text>
                </View>
            </View>
        </View>
    )
}

export default PropertyItem