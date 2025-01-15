import { TouchableWithoutFeedback, Keyboard, StatusBar, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView } from "react-native";
import React, { useState } from "react";
import { Stack, router } from "expo-router";
import GoogleIcon from "@/components/icons/GoogleIcon";
import { ScrollView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { InputProps } from "@/types/type";

type Props = {};

const SigninScreen = () => {
  const [inputEmail, setInputEmail] = useState<InputProps>({
    isFocused: false,
    value: "",
  });
  const [inputPassword, setInputPassword] = useState<InputProps>({
    isFocused: false,
    value: "",
    secureTextEntry: false
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleSubmit = () => {
    const email = inputEmail.value;
    const password = inputPassword.value;

    setErrors({ ...errors, global: "Oops, something went wrong" });
    console.log(email, password);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={'dark-content'}
      />
      <KeyboardAvoidingView 
        behavior="padding"
        className="flex-1 px-5 pt-20 bg-white"
      >
        <TouchableWithoutFeedback className="flex-1" onPress={Keyboard.dismiss}>
          <View className="flex-1">
            <View className="flex-row space-x-6">
              <TouchableOpacity onPress={() => {router.push('/signin')}}>
                <Text className="text-base font-medium pb-3 mb-4 border-b-2 text-blue-500 border-blue-500">Connexion</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {router.push('/signup')}}>
                <Text className="text-base font-medium pb-3 mb-4">Inscription</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              className="flex-1 pt-4"
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {errors && errors?.global && <Text className="text-red-500 text-sm">{errors?.global}</Text>}
              <View className="mt-4">
                <Text className="text-base mb-2 ml-1">Adresse Email</Text>
                <View className={`border border-gray-200 bg-gray-50 px-4 py-2 rounded-xl ${inputEmail.isFocused ? 'border-blue-500' : ''}`}>
                  <TextInput
                    placeholder="Adresse e-mail"
                    editable
                    textContentType="emailAddress"
                    value={inputEmail.value}
                    className="text-base"
                    cursorColor="#3b82f6"
                    onFocus={() => {setInputEmail({ ...inputEmail, isFocused: true }) }}
                    onBlur={() => {setInputEmail({ ...inputEmail, isFocused: false }) }}
                    onChangeText={(text) => {setInputEmail({ ...inputEmail, value: text }) }}
                  />
                </View>
              </View>
              <View className="mt-4">
                <Text className="text-base mb-2 ml-1">Mot de passe</Text>
                <View className={`relative border border-gray-200 bg-gray-50 px-4 py-2 rounded-xl ${inputPassword.isFocused ? 'border-blue-500' : ''}`}>
                  <TextInput
                    placeholder="***************"
                    editable
                    textContentType="password"
                    secureTextEntry={inputPassword.secureTextEntry}
                    value={inputPassword.value}
                    className="text-base"
                    cursorColor="#3b82f6"
                    onFocus={() => {setInputPassword({ ...inputPassword, isFocused: true })}}
                    onBlur={() => {setInputPassword({ ...inputPassword, isFocused: false }) }}
                    onChangeText={(text) => {setInputPassword({ ...inputPassword, value: text }) }}
                  />
                  <View className="absolute top-4 right-4">
                    <TouchableOpacity
                      onPress={() => {setInputPassword({ ...inputPassword, secureTextEntry: !inputPassword.secureTextEntry }) }}
                    >
                      <Ionicons name={inputPassword.secureTextEntry ? "eye-off" : "eye"} size={30} color="#3b82f6" />
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity>
                  <Text className="text-right my-3">Mot de passe oublié ?</Text>
                </TouchableOpacity>
              </View>
              <View className="mt-4">
                <TouchableOpacity
                  onPress={handleSubmit}
                  className="rounded-xl bg-blue-500 py-4"
                >
                  <Text className="text-base text-white text-center font-medium">Se connecter</Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row items-center space-x-4 my-10">
                <View className="flex-1 h-0.5 bg-gray-200" />
                <Text className="font-bold uppercase text-base text-gray-600">Ou</Text>
                <View className="flex-1 h-0.5 bg-gray-200" />
              </View>
              <View className="">
                <TouchableOpacity onPress={() => { }} className="rounded-xl border border-blue-500 py-3 flex-row space-x-2 justify-center items-center">
                  <GoogleIcon size={30} />
                  <Text className="text-base text-center font-medium">Se connecter avec Google</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => {
                  router.dismissAll();
                  router.push('/(tabs)');
                }}
              >
                <Text className="text-center mt-8 font-medium text-base text-blue-500">Continuer sans se connecter</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
};

export default SigninScreen;