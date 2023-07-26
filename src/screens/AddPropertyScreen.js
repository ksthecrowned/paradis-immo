import { View, Text, TextInput, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'

// Import components
import SecondaryTopMenu from "../components/SecondaryTopMenu"
import NestedPageTitle from "../components/NestedPageTitle"
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

const page_title = "Ajouter une propriété"
const description = "Créez une alerte immobilière et soyez notifié quand une propriété ayant vos critères sera publiée."

const AddPropertyScreen = () => {

    return (
        <SafeAreaView className="flex-1">

            {/* Top Menu */}
            <SecondaryTopMenu statusBarStyle={'light-content'} screen={'addproperty'} title={page_title} />

            <ScrollView className="bg-white" showsVerticalScrollIndicator={false}>
                <NestedPageTitle
                    title={page_title}
                    description={description}
                />
                {fields.map((field) => {
                    return (
                        <View className="mt-4 px-5" key={field.id}>
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
                <View className="mt-4 mb-28 px-5">
                    <TouchableOpacity className="rounded-xl bg-blue-500 py-4">
                        <Text className="text-base text-white text-center font-medium">Enregistrer</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

export default AddPropertyScreen