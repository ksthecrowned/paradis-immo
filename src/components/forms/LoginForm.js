import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native'
import React from 'react'

import googleLogo from '../../../assets/logos/logo-google.png'
import facebookLogo from '../../../assets/logos/logo-facebook.png'

const LoginForm = () => {
    return (
        <>
            <View className="mt-4">
                <Text className="text-base mb-2 ml-1">Adresse Email</Text>
                <View className="border border-gray-200 bg-gray-50 p-4 rounded-xl">
                    <TextInput
                        inlineImageLeft='search_icon'
                        placeholder="Adresse e-mail"
                        editable
                        value=""
                        className="text-base"
                    />
                </View>
            </View>
            <View className="mt-4">
                <Text className="text-base mb-2 ml-1">Mot de passe</Text>
                <View className="border border-gray-200 bg-gray-50 p-4 rounded-xl">
                    <TextInput
                        inlineImageLeft='search_icon'
                        placeholder="Mot de passe"
                        editable
                        value=""
                        className="text-base"
                    />
                </View>
                <Text className="text-right my-3">Mot de passe oublié ?</Text>
            </View>
            <View className="mt-4">
                <TouchableOpacity className="rounded-xl bg-blue-500 py-4">
                    <Text className="text-base text-white text-center font-medium">Se connecter</Text>
                </TouchableOpacity>
            </View>
            <Text className="text-center my-6 font-medium uppercase text-xs">Ou continuer avec</Text>
            <View className="">
                <TouchableOpacity className="rounded-xl border border-blue-500 py-3 flex-row space-x-2 justify-center items-center">
                    <Image className="h-8 w-8 rounded-full" source={googleLogo} />
                    <Text className="text-base text-center font-medium">Google</Text>
                </TouchableOpacity>
            </View>
            <View className="mt-4">
                <TouchableOpacity className="rounded-xl border border-blue-500 py-3 flex-row space-x-2 justify-center items-center">
                    <Image className="h-10 w-10 rounded-full" source={facebookLogo} />
                    <Text className="text-base text-center font-medium">Facebook</Text>
                </TouchableOpacity>
            </View>
        </>
    )
}

export default LoginForm