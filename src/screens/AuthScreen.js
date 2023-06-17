import { View, Text, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'
import { TabView, SceneMap } from 'react-native-tab-view'

import LoginForm from '../components/forms/LoginForm'
import RegisterForm from '../components/forms/RegisterForm'

const AuthScreen = () => {
    const [currentTab, setCurrentTab] = useState('login')
    return (
        <SafeAreaView className="px-5 pt-20">
            <StatusBar
                backgroundColor="transparent"
                translucent={true}
                barStyle={'dark-content'}
            />
            <View className="">
                <View className="flex-row space-x-6">
                    <TouchableOpacity onPress={() => setCurrentTab('login')}>
                        <Text className={"text-base font-medium pb-3 mb-8" + (currentTab == 'login' ? " border-b-2 text-blue-500 border-blue-500" : "")}>Connexion</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCurrentTab('register')}>
                        <Text className={"text-base font-medium pb-3 mb-8" + (currentTab == 'register' ? " border-b-2 text-blue-500 border-blue-500" : "")}>Inscription</Text>
                    </TouchableOpacity>
                </View>
                {currentTab == "login" && <LoginForm />}
                {currentTab == "register" && <RegisterForm />}
            </View>
        </SafeAreaView>
    )
}

export default AuthScreen