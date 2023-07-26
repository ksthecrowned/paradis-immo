import { View, Text, SafeAreaView, Image, ScrollView  } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useEffect, useState } from 'react'

// Import components
import SearchForm from "../components/SearchForm"
import PrimaryTopMenu from "../components/PrimaryTopMenu"

// Import assets
import buildingIcon from '../../assets/icons/buildingIcon.png'
import houseForSale from '../../assets/icons/house-for-sale.png'
import buyProperty from '../../assets/icons/buy-property.png'

import building from '../../assets/icons/building.png'
import building01 from '../../assets/icons/building01.png'
import building02 from '../../assets/icons/building02.png'
import building03 from '../../assets/icons/building03.png'

import { getCategories } from '../../api' 
import { urlFor } from '../../sanity' 
import { auth } from '../../firebase'
import { signOut } from "firebase/auth"

const HomeScreen = () => {
    const handleSignOut = () => {
        signOut(auth)
            .then(() => {
                console.log('signed out')
            })
            .catch(error => alert(error.message))
    }
    const cardShadow = {
        shadowColor: "rgb(59, 130, 246)",
        shadowOffset: {
            width: 0,
            height: 18,
        },
        shadowOpacity:  0.25,
        shadowRadius: 20.00,
        elevation: 24
    }
    const navigation = useNavigation()
    const [ categories, setCategories ] = useState([])

    useEffect(() => {
        getCategories().then(data => {
            setCategories(data)
        })
    }, [])
    return (
        <SafeAreaView className="flex-1">

            {/* Top Menu */}
            <PrimaryTopMenu statusBarStyle={'light-content'} screen={'home'} />

            <ScrollView>
                <View className="bg-blue-500 relative overflow-hidden pt-36 pb-20 px-4">
                    {/* Paths... */}
                    <View className="h-72 w-72 rounded-full absolute -top-44 -left-36 bg-blue-400 opacity-30"></View>
                    <View className="h-96 w-96 rounded-full absolute -bottom-52 -left-48 bg-blue-400 opacity-30"></View>
                    <View className="h-28 w-28 rounded-full absolute top-36 left-32 bg-blue-400 opacity-30"></View>
                    <View className="h-10 w-10 rounded-full absolute top-20 right-12 bg-blue-400 opacity-30"></View>

                    {/* Content */}
                    <View className="space-y-2 absolute top-12 left-6">
                        <View className="h-1 rounded-full w-4 bg-white"></View>
                        <View className="h-1 rounded-full w-8 bg-white"></View>
                        <View className="h-1 rounded-full w-6 bg-gray-50"></View>
                    </View>
                    <Text className="text-4xl font-black text-white text-center">Bienvenue sur Paradis Immobilier.</Text>
                    <Text className="text-white font-medium mt-2 text-sm text-center">
                        Ne cherchez plus, trouvez le bien Immobilier qui vous correspond le plus en quelques cliques.
                    </Text>
                    
                    {/* Search & Filters Form */}
                    <SearchForm />
                    
                </View>
                <View className="-mt-8 rounded-t-3xl bg-white px-4 pt-10">
                    <View className="-mx-4 -my-8">
                        <View className="px-4 mt-6">
                            <View>
                                <Text className="font-bold text-2xl text-blue-900">L'immobilier</Text>
                                <Text className="text-gray-600">Que souhaitez-vous faire ?</Text>
                            </View>
                            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} className="flex-row -m-4">
                                <View className="h-32 w-32 rounded-2xl bg-white items-center justify-center mx-2 mt-6 mb-12 ml-4" style={cardShadow}>
                                    <Image source={houseForSale} className="h-12 w-12 mb-2 object-cover" ></Image>
                                    <Text className="font-bold uppercase">Louer</Text>
                                </View>
                                <View className="h-32 w-32 rounded-2xl bg-white items-center justify-center mx-2 mt-6 mb-12" style={cardShadow}>
                                    <Image source={buyProperty} className="h-12 w-12 mb-2 object-cover" ></Image>
                                    <Text className="font-bold uppercase">Acheter</Text>
                                </View>
                                <View className="h-32 w-32 rounded-2xl bg-white items-center justify-center mx-2 mt-6 mb-12" style={cardShadow}>
                                    <Image source={buildingIcon} className="h-12 w-12 mb-2 object-cover" ></Image>
                                    <Text className="font-bold uppercase">Vendre</Text>
                                </View>
                            </ScrollView>
                        </View>
                        <View className="px-4 pb-28">
                            <View>
                                <Text className="font-bold text-2xl text-blue-900">Gategories</Text>
                            </View>
                            <View className="flex-row flex-wrap mt-2 -mx-2">
                                {
                                    categories.map(category => {
                                        return (
                                            <View key={category._id} className="p-2 w-1/2">
                                                <View className="h-44 w-full items-center justify-center bg-white rounded-2xl p-4" style={cardShadow}>
                                                    <Image 
                                                        source={{
                                                            uri: urlFor(category.icon).url()
                                                        }} 
                                                        className="h-28 w-24 mb-2 object-cover" 
                                                    />
                                                    <Text className="font-bold uppercase">{category.name}</Text>
                                                </View>
                                            </View>
                                        )
                                    })
                                }
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

export default HomeScreen