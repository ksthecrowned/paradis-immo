import { TouchableWithoutFeedback, Keyboard, StatusBar, Text, TextInput, TouchableOpacity, View, ScrollView, KeyboardAvoidingView } from "react-native";
import React, { useState } from "react";
import { Stack, router } from "expo-router";
import { registrationValidationSchema } from "@/constants/validation";
import { validateForm } from "@/utils/utilities";
import { Ionicons } from "@expo/vector-icons";
import { InputProps } from "@/types/type";

type Props = {};

const SignupScreen = () => {
  const [inputEmail, setInputEmail] = useState<InputProps>({
    isFocused: false,
    value: ""
  });
  const [inputPassword, setInputPassword] = useState<InputProps>({
    isFocused: false,
    value: "",
    secureTextEntry: false
  });
  const [inputConfirmPassword, setInputConfirmPassword] = useState<InputProps>({
    isFocused: false,
    value: "",
    secureTextEntry: false
  });
  const [inputName, setInputName] = useState<InputProps>({
    isFocused: false,
    value: ""
  });
  const [inputPhone, setInputPhone] = useState<InputProps>({
    isFocused: false,
    value: ""
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleSubmit = () => {
    const email = inputEmail.value;
    const password = inputPassword.value;
    const confirmPassword = inputConfirmPassword.value;
    const name = inputName.value;
    const phone = inputPhone.value;

    setErrors({});
    const errors = validateForm({ email, password, confirmPassword, name, phone }, registrationValidationSchema)
    if (errors && Object.keys(errors).length > 0) {
      return setErrors(errors)
    }
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
        className="flex-1 pt-20 px-5 bg-white"
      >
        <TouchableWithoutFeedback className="flex-1" onPress={Keyboard.dismiss}>
          <View className="flex-1">
            <View className="flex-row space-x-6">
              <TouchableOpacity onPress={() => {router.push('/signin')}}>
                <Text className="text-base font-medium pb-3 mb-4">Connexion</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {}}>
                <Text className="text-base font-medium pb-3 mb-4 border-b-2 text-blue-500 border-blue-500">Inscription</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              className="flex-1 pt-4"
            >
              {errors && errors?.global && <Text className="text-red-500 text-sm">{errors?.global}</Text>}
              <View className="mt-4">
                <Text className="text-base mb-2 ml-1">Adresse Email</Text>
                <View className={
                  `border border-gray-200 bg-gray-50 px-4 py-2 rounded-xl 
                  ${inputEmail.isFocused ? 'border-blue-500' : errors.email ? 'border-red-500' : ''}`
                }>
                  <TextInput
                    placeholder="Adresse e-mail"
                    editable
                    value={inputEmail.value}
                    className="text-base"
                    cursorColor="#3b82f6"
                    onFocus={() => {setInputEmail({ ...inputEmail, isFocused: true }) }}
                    onBlur={() => {setInputEmail({ ...inputEmail, isFocused: false }) }}
                    onChangeText={(text) => {setInputEmail({ ...inputEmail, value: text }) }}
                  />
                </View>
                {errors.email && <Text className="text-red-500 text-sm p-1">{errors.email}</Text>}
              </View>
              <View className="mt-4">
                <Text className="text-base mb-2 ml-1">Nom complet</Text>
                <View className={
                  `border border-gray-200 bg-gray-50 px-4 py-2 rounded-xl 
                  ${inputName.isFocused ? 'border-blue-500' : errors.name ? 'border-red-500' : ''}`
                }>
                  <TextInput
                    placeholder="Votre nom complet"
                    editable
                    value={inputName.value}
                    className="text-base"
                    cursorColor="#3b82f6"
                    onFocus={() => {setInputName({ ...inputName, isFocused: true }) }}
                    onBlur={() => {setInputName({ ...inputName, isFocused: false }) }}
                    onChangeText={(text) => {setInputName({ ...inputName, value: text }) }}
                  />
                </View>
                {errors.name && <Text className="text-red-500 text-sm p-1">{errors.name}</Text>}
              </View>
              <View className="mt-4">
                <Text className="text-base mb-2 ml-1">Numéro de téléphone</Text>
                <View className={
                  `border border-gray-200 bg-gray-50 px-4 py-2 rounded-xl 
                  ${inputPhone.isFocused ? 'border-blue-500' : errors.phone ? 'border-red-500' : ''}`
                }>
                  <TextInput
                    placeholder="Votre numéro de téléphone"
                    editable
                    value={inputPhone.value}
                    keyboardType="phone-pad"
                    className="text-base"
                    cursorColor="#3b82f6"
                    onFocus={() => {setInputPhone({ ...inputPhone, isFocused: true }) }}
                    onBlur={() => {setInputPhone({ ...inputPhone, isFocused: false }) }}
                    onChangeText={(text) => {setInputPhone({ ...inputPhone, value: text }) }}
                  />
                </View>
                {errors.phone && <Text className="text-red-500 text-sm p-1">{errors.phone}</Text>}
              </View>
              <View className="mt-4">
                <Text className="text-base mb-2 ml-1">Mot de passe</Text>
                <View className={
                  `relative border border-gray-200 bg-gray-50 px-4 py-2 rounded-xl 
                  ${inputPassword.isFocused ? 'border-blue-500' : errors.password ? 'border-red-500' : ''}`
                }>
                  <TextInput
                    placeholder="***************"
                    editable
                    textContentType="password"
                    secureTextEntry={!inputPassword.secureTextEntry}
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
                {errors.password && <Text className="text-red-500 text-sm p-1">{errors.password}</Text>}
              </View>
              <View className="mt-4">
                <Text className="text-base mb-2 ml-1">Confirmer le mot de passe</Text>
                <View className={
                  `relative border border-gray-200 bg-gray-50 px-4 py-2 rounded-xl 
                  ${inputConfirmPassword.isFocused ? 'border-blue-500' : errors.confirmPassword ? 'border-red-500' : ''}`
                }>
                  <TextInput
                    placeholder="***************"
                    editable
                    textContentType="password"
                    secureTextEntry={!inputConfirmPassword.secureTextEntry}
                    value={inputConfirmPassword.value}
                    className="text-base"
                    cursorColor="#3b82f6"
                    onFocus={() => {setInputConfirmPassword({ ...inputConfirmPassword, isFocused: true })}}
                    onBlur={() => {setInputConfirmPassword({ ...inputConfirmPassword, isFocused: false }) }}
                    onChangeText={(text) => {setInputConfirmPassword({ ...inputConfirmPassword, value: text }) }}
                  />
                  <View className="absolute top-4 right-4">
                    <TouchableOpacity
                      onPress={() => {setInputConfirmPassword({ ...inputConfirmPassword, secureTextEntry: !inputConfirmPassword.secureTextEntry }) }}
                    >
                      <Ionicons name={inputConfirmPassword.secureTextEntry ? "eye-off" : "eye"} size={30} color="#3b82f6" />
                    </TouchableOpacity>
                  </View>
                </View>
                {errors.confirmPassword && <Text className="text-red-500 text-sm p-1">{errors.confirmPassword}</Text>}
              </View>
              <View className="mt-6">
                <TouchableOpacity
                  onPress={handleSubmit}
                  className="rounded-xl bg-blue-500 py-4"
                >
                  <Text className="text-base text-white text-center font-medium">S'inscrire</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
};

export default SignupScreen;