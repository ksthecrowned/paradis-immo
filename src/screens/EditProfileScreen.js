import { View, Text, TextInput, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'

// Import components
import TopMenu from "../components/TopMenu"
import InputText from "../components/forms/InputText"

const fields = [
    {
        id: "title",
        name: "title",
        label: "Titre",
        keyboardType: "default",
        placeholder: "Titre de l'annonce",
        multiline: false,
        numberOfLines: 1
    },
    {
        id: "ville",
        name: "ville",
        label: "Ville",
        keyboardType: "default",
        placeholder: "Titre de l'annonce",
        multiline: false,
        numberOfLines: 1
    },
    {
        id: "quartier",
        name: "quartier",
        label: "Quartier",
        keyboardType: "numeric",
        placeholder: "Titre de l'annonce",
        multiline: false,
        numberOfLines: 1
    },
    {
        id: "adress",
        name: "adress",
        label: "Addresse",
        keyboardType: "default",
        placeholder: "Titre de l'annonce",
        multiline: false,
        numberOfLines: 1
    },
    {
        id: "description",
        name: "description",
        label: "Description",
        keyboardType: "default",
        placeholder: "Description",
        multiline: true,
        numberOfLines: 4
    }
]

const EditProfileScreen = () => {

    return (
        <SafeAreaView className="flex-1">

            {/* Top Menu */}
            <TopMenu statusBarStyle={'light-content'} screen={'editprofile'} showBackArrow={true} />

            <ScrollView className="px-5 pt-28 bg-white" showsVerticalScrollIndicator={false}>
                {fields.map((field) => {
                    return (
                        <View className="mt-4" key={field.id}>
                            <Text className="text-base mb-2 ml-1">{field.label}</Text>
                            <InputText
                                name={field.name}
                                placeholder={field.placeholder}
                                keyboardType={field.keyboardType}
                                multiline={field.multiline}
                                numberOfLines={field.numberOfLines}
                                className="text-base"
                            />
                        </View>
                    )
                })}
                <View className="mt-4 mb-28">
                    <TouchableOpacity className="rounded-xl bg-blue-500 py-4">
                        <Text className="text-base text-white text-center font-medium">Enregistrer</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

export default EditProfileScreen