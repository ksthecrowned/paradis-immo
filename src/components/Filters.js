import { View, Text, Button, Image, TextInput, TouchableOpacity  } from 'react-native'
import React, { useState } from 'react'
import { Formik } from 'formik'

import InputRange from "./forms/InputRange"
import CategoriesList from "./filters/CategoriesList"
import NumOfRoom from "./filters/NumOfRoom"

import buildingIcon from '../../assets/icons/buildingIcon.png'
import houseForSale from '../../assets/icons/house-for-sale.png'
import buyProperty from '../../assets/icons/buy-property.png'
import bedBlue from '../../assets/icons/bed-blue.png'
import bedWhite from '../../assets/icons/bed.png'
import bathBlue from '../../assets/icons/bathtub-blue.png'
import bathWhite from '../../assets/icons/bathtub.png'

const Filters = () => {
    const [object, setObject] = useState("rent")

    return (
        <Formik
            initialValues={{ email: '' }}
            onSubmit={values => console.log(values)}
        >
            {({ handleChange, handleBlur, handleSubmit, values }) => (
            <View className="px-4">
                <Text className="text-center text-xl text-blue-900 font-bold my-3">Filtres</Text>
                <View className="space-y-4">

                    <View className="flex-row justify-center">
                        <TouchableOpacity 
                            onPress={() => setObject("rent")} 
                            className={"py-3 px-8 rounded-lg bg-white flex-row space-x-2 items-center justify-center mx-2 border border-gray-200 " + (object == "rent" ? "border-blue-500" : "")}
                        >
                            <Image source={houseForSale} className="h-6 w-6 mb-2 object-cover" ></Image>
                            <Text className="font-bold uppercase">Location</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setObject("sell")} 
                            className={"py-3 px-8 rounded-lg bg-white flex-row space-x-2 items-center justify-center mx-2 border border-gray-200 " + (object == "sell" ? "border-blue-500" : "")}
                        >
                            <Image source={buyProperty} className="h-6 w-6 mb-2 object-cover" ></Image>
                            <Text className="font-bold uppercase">Vente</Text>
                        </TouchableOpacity>
                        <TextInput className="hidden" value={object} />
                    </View>

                    <View className="border-t pt-3 border-blue-200">
                        <Text className="text-base text-gray-800">Types de propriétés</Text>
                        <CategoriesList />
                    </View>

                    <View className="border-t pt-3 border-blue-200">
                        <Text className="text-base text-gray-800 mb-1">Nombre de chambres</Text>
                        <NumOfRoom iconInactive={bedBlue} iconActive={bedWhite} />
                    </View>

                    <View className="border-t pt-3 border-blue-200">
                        <Text className="text-base text-gray-800 mb-1">Nombre de salles de bain</Text>
                        <NumOfRoom iconInactive={bathBlue} iconActive={bathBlue}  />
                    </View>

                    <View className="border-t py-3 border-blue-200">
                        <InputRange 
                            min={10000} 
                            max={600000} 
                            title='Prix' 
                            steps={1000} 
                            onValueChange={(range) => { console.log(range) }}
                        />
                    </View>
                </View>
                <View className="my-5">
                    <Button onPress={handleSubmit} title="Appliquer les filtres" />
                </View>
            </View>
            )}
        </Formik>
    )
}

export default Filters