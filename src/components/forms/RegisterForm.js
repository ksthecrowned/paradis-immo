import React from 'react'
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView  } from 'react-native'
import InputText from './InputText'
import { auth } from '../../../firebase'
// import { sendWhatsAppVerificationCode } from '../../../WhatsAppService'

const fields = [
    {
        id: "name",
        name: "name",
        label: "Nom",
        keyboardType: "default",
        placeholder: "Votre nom",
        multiline: false,
        numberOfLines: 1
    },
    {
        id: "first_name",
        name: "first_name",
        label: "Prénom",
        keyboardType: "default",
        placeholder: "Votre prénom",
        multiline: false,
        numberOfLines: 1
    },
    {
        id: "email",
        name: "email",
        label: "Adresse Email",
        keyboardType: "default",
        placeholder: "Votre adresse e-mail",
        multiline: false,
        numberOfLines: 1
    },
    {
        id: "phone",
        name: "phone",
        label: "Numéro de téléphone",
        keyboardType: "numeric",
        placeholder: "Votre numéro de téléphone",
        multiline: false,
        numberOfLines: 1
    },
    {
        id: "password",
        name: "password",
        label: "Mot de passe",
        keyboardType: "default",
        placeholder: "**********",
        multiline: false,
        numberOfLines: 1
    }
]

const RegisterForm = () => {

    const handleSignUp = async (data) => {
        // Submit the form data to your server or perform other actions
        console.log(data)
    }

    const handleRegister = async (data) => {
        try {
            // Request OTP from Firebase
            const confirmation = await auth().signInWithPhoneNumber(data.phone)

            // Send verification code via WhatsApp
            await sendWhatsAppVerificationCode(data.phone, confirmation.verificationId)

            // Navigate to OTP verification screen passing confirmation object
            // For example, navigate to 'OTPScreen' and pass confirmation object as a parameter
        } catch (error) {
            console.error('Error sending OTP:', error)
        }
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            contentContainerStyle={{ flexGrow: 1 }}
            enableOnAndroid
            keyboardShouldPersistTaps="handled"
        >
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {fields.map((field) => {
                    return (
                        <View className="" key={field.id}>
                            <Text className="text-base mb-2 ml-1">{field.label}</Text>
                            <InputText
                                name={field.name}
                                placeholder={field.placeholder}
                                keyboardType={field.keyboardType}
                                multiline={field.multiline}
                                numberOfLines={field.numberOfLines}
                            />
                        </View>
                    )
                })}
                <View className="mt-4">
                    <TouchableOpacity className="rounded-xl bg-blue-500 py-4">
                        <Text className="text-base text-white text-center font-medium">S'inscrire</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

export default RegisterForm