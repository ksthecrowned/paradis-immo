import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native'
import React from 'react'

const RegisterForm = () => {
    return (
        <>
            <View className="mt-4">
                <Text className="text-base mb-2 ml-1">Nom</Text>
                <View className="border border-gray-200 bg-gray-50 p-4 rounded-xl">
                    <TextInput
                        inlineImageLeft='search_icon'
                        placeholder="Votre nom"
                        editable
                        value=""
                        className="text-base"
                    />
                </View>
            </View>
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
                <Text className="text-base mb-2 ml-1">Numéro de téléphone</Text>
                <View className="border border-gray-200 bg-gray-50 p-4 rounded-xl">
                    <TextInput
                        inlineImageLeft='search_icon'
                        placeholder="Votre numéro de téléphone"
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
            </View>
            <View className="mt-4">
                <TouchableOpacity className="rounded-xl bg-blue-500 py-4">
                    <Text className="text-base text-white text-center font-medium">S'inscrire</Text>
                </TouchableOpacity>
            </View>
        </>
    )
}

export default RegisterForm