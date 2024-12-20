import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native'
import { auth, googleProvider } from '../../../firebase'
import { useEffect } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth"

import googleLogo from '../../../assets/logos/logo-google.png'
import facebookLogo from '../../../assets/logos/logo-facebook.png'

const LoginForm = () => {
    const email = "kaiserstyve2@gmail.com"
    const password = "123456"

    const handleSignUp = () => {
        createUserWithEmailAndPassword(auth, email, password)
            .then(useCredentials => {
                const user = useCredentials.user
                console.log(user.email)
            })
            .catch(error => alert(error.message))
    }

    const handleSignIn = () => {
        signInWithEmailAndPassword(auth, email, password)
        .then(useCredentials => {
            const user = useCredentials.user
            console.log("logged in with: ", user.email)
        })
        .catch(error => alert(error.message))
    }

    const handleGoogleSignIn = () => {
        signInWithPopup(auth, googleProvider)
        //     .then((result) => {
        //         // This gives you a Google Access Token. You can use it to access the Google API.
        //         const credential = GoogleAuthProvider.credentialFromResult(result);
        //         const token = credential.accessToken;
        //         // The signed-in user info.
        //         const user = result.user;
        //         // IdP data available using getAdditionalUserInfo(result)
        //         // ...
        //     }).catch((error) => {
        //         // Handle Errors here.
        //         const errorCode = error.code;
        //         const errorMessage = error.message;
        //         // The email of the user's account used.
        //         const email = error.customData.email;
        //         // The AuthCredential type that was used.
        //         const credential = GoogleAuthProvider.credentialFromError(error);
        //         // ...
        //     })
    }

    return (
        <View className="flex-1">
            <View className="mt-4">
                <Text className="text-base mb-2 ml-1">Adresse Email</Text>
                <View className="border border-gray-200 bg-gray-50 p-4 rounded-xl">
                    <TextInput
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
                        placeholder="Mot de passe"
                        editable
                        value=""
                        className="text-base"
                    />
                </View>
                <Text className="text-right my-3">Mot de passe oublié ?</Text>
            </View>
            <View className="mt-4">
                <TouchableOpacity 
                    onPress={handleSignIn}
                    className="rounded-xl bg-blue-500 py-4"
                >
                    <Text className="text-base text-white text-center font-medium">Se connecter</Text>
                </TouchableOpacity>
            </View>
            <Text className="text-center my-6 font-medium uppercase text-xs">Ou continuer avec</Text>
            <View className="">
                <TouchableOpacity onPress={handleGoogleSignIn} className="rounded-xl border border-blue-500 py-3 flex-row space-x-2 justify-center items-center">
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
            <Text className="text-center mt-8 font-medium uppercase">Ou continuer sans se connecter</Text>
        </View>
    )
}

export default LoginForm