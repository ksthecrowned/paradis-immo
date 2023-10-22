import { View, Text, TextInput, TouchableOpacity, Image, Animated, Easing, SafeAreaView } from 'react-native'
import { auth, googleProvider } from '../../../firebase'
import { useEffect, useState } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth"

import googleLogo from '../../../assets/logos/logo-google.png'
import facebookLogo from '../../../assets/logos/logo-facebook.png'

import Modal from "react-native-modal"

const LoginForm = () => {
    const [isLoading, setIsLoading] = useState(false)
    const [isModalVisible, setIsModalVisible] = useState(false)
    const [modalContent, setModalContent] = useState({
        title: "",
        paragraph: ""
    })
    
    const email = "kaiserstyve2@gmail.com"
    const password = "12345600"

    const pulseAnimation = new Animated.Value(1)

    const startPulseAnimation = () => {
        pulseAnimation.setValue(1);
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnimation, {
                    toValue: 0.6,
                    duration: 500,
                    useNativeDriver: true,
                    easing: Easing.inOut(Easing.ease),
                }),
                Animated.timing(pulseAnimation, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                    easing: Easing.inOut(Easing.ease),
                }),
            ])
        ).start();
    };

    useEffect(() => {
        if (isLoading) {
            startPulseAnimation()
        }
        startPulseAnimation()
    }, [isLoading]);

    const handleSignUp = () => {
        createUserWithEmailAndPassword(auth, email, password)
            .then(useCredentials => {
                const user = useCredentials.user
                console.log(user.email)
            })
            .catch(error => alert(error.message))
    }

    const handleSignIn = () => {
        if(isLoading) {
            return 
        }
        setIsLoading(true)
        signInWithEmailAndPassword(auth, email, password)
            .then(useCredentials => {
                const user = useCredentials.user
                console.log("logged in with: ", user.email)
            })
            .catch(error => {
                const errorCode = error.code
                console.log(errorCode)
                if(['auth/invalid-email', 'auth/user-not-found', 'auth/wrong-password'].includes(errorCode)) {
                    setModalContent({ ...modalContent, title: 'Identifiants incorrects!' })
                    // alert('Identifiants incorrects!')
                }
                else if(['auth/too-many-requests'].includes(errorCode)) {
                    setModalContent({ ...modalContent, title: 'Trop de requetes!' })
                    // alert('Trop de requetes!')
                }
                else {
                    setModalContent({ ...modalContent, title: "Oops, une erreur s'est produite" })
                    // alert("Oops, une erreur s'est produite")
                }
                setIsLoading(false)
                setIsModalVisible(true)
            })
    }

    const handleGoogleSignIn = () => {
        if(isLoading) {
            return 
        }
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
        <SafeAreaView className="flex-1">
            <Modal isVisible={isModalVisible} className="flex-1">
                <View className="flex-1 items-center justify-center">
                    <View className="items-center justify-center w-full h-80 rounded-2xl bg-white">
                        <Text>{modalContent?.title}</Text>
                        <TouchableOpacity
                            className="bg-blue-500 mt-12 rounded-xl py-4 flex-row justify-center items-center"
                            onPress={() => setIsModalVisible(!isModalVisible)}
                        >
                            <Text className="text-center text-base">Close modal</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
                    className={`rounded-xl py-4 flex-row justify-center items-center space-x-1 ${isLoading ? 'bg-blue-500/75' : 'bg-blue-500'}`}
                >
                    <Text className="text-base text-white text-center font-medium">Se connecter</Text>
                    <View className={!isLoading ? "hidden" : "inline-flex relative"}>
                        <Animated.View
                            className="w-6 h-6 bg-white opacity-50 rounded-full"
                            style={{
                                transform: [{ scale: pulseAnimation }],
                            }}
                        />
                        <View className="absolute top-0 w-6 h-6 items-center justify-center">
                            <View className="w-3 h-3 bg-white opacity-80 rounded-full" />
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
            <Text className="text-center my-6 font-medium uppercase text-xs">Ou continuer avec</Text>
            <View className="">
                <TouchableOpacity onPress={handleGoogleSignIn} className="rounded-xl border border-blue-500 py-3 flex-row space-x-2 justify-center items-center">
                    <Image className="h-7 w-7 rounded-full" source={googleLogo} />
                    <Text className="text-base text-center font-medium">Google</Text>
                </TouchableOpacity>
            </View>
            <View className="mt-4">
                <TouchableOpacity className="rounded-xl border border-blue-500 py-3 flex-row space-x-2 justify-center items-center">
                    <Image className="h-8 w-8 rounded-full" source={facebookLogo} />
                    <Text className="text-base text-center font-medium">Facebook</Text>
                </TouchableOpacity>
            </View>
            <Text className="text-center mt-8 font-medium uppercase">Ou continuer sans se connecter</Text>
        </SafeAreaView>
    )
}

export default LoginForm