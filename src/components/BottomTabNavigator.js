import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, Image, View, TouchableOpacity, StyleSheet } from 'react-native'
import { useRef, useEffect } from 'react'
import * as Animatable from 'react-native-animatable'

import HomeScreen from '../../src/screens/HomeScreen'
import SearchScreen from '../../src/screens/SearchScreen'
import PropertyScreen from '../../src/screens/PropertyScreen'
import FavoritesScreen from '../../src/screens/FavoritesScreen'
import NotificationsScreen from '../../src/screens/NotificationsScreen'
import SettingsScreen from '../../src/screens/SettingsScreen'

import homeWhite from '../../assets/navicons/home-white.png'
import homeBlue from '../../assets/navicons/home-blue.png'
import gearWhite from '../../assets/navicons/gear-white.png'
import gearBlue from '../../assets/navicons/gear-blue.png'
import bellWhite from '../../assets/navicons/bell-white.png'
import bellBlue from '../../assets/navicons/bell-blue.png'
import search from '../../assets/icons/search.png'
import heart from '../../assets/icons/heart.png'
import heartBlue from '../../assets/icons/heart-blue.png'

const Tab = createBottomTabNavigator()

const animate1 = {0: {scale: .5, translateY: 8}, 0.92: {translateY: -34}, 1: {scale: 1.2, translateY: -24}}
const animate2 = {0: {scale: 1.2, translateY: -24}, 1: {scale: 1, translateY: 8}}

const circleanim1 = {0: {scale: 0}, 0.3: {scale: .9}, 0.5: {scale: .2}, 0.8: {scale: .7}, 1: {scale: 1}}
const circleanim2 = {0: {scale: 1}, 1: {scale: 0}}

const TabButton = (props) => {
    const {icon, label, onPress, accessibilityState} = props
    const focused = accessibilityState.selected
    const viewRef = useRef(null)
    const circleRef = useRef(null)
    const textRef = useRef(null)

    useEffect(() => {
        if(focused) {
            viewRef.current.animate(animate1)
            circleRef.current.animate(circleanim1)
            textRef.current.transitionTo({scale: 1})
        } else {
            viewRef.current.animate(animate2)
            circleRef.current.animate(circleanim2)
            textRef.current.transitionTo({scale: 0})
        }
    }, [focused])

    return (
        <TouchableOpacity className="flex-1 justify-center items-center"
            onPress={onPress}
            activeOpacity={1}
        >
            <Animatable.View
                ref={viewRef}
                duration={800}
                className="flex-1 justify-center items-center"
            >
                {label == "Notifications" 
                    && <View className={"absolute z-50 items-center justify-center top-2 h-4 w-4 rounded-full bg-red-600 " + (focused ? "left-6" : "left-7")}>
                        <Text className="text-white" style={{fontSize:10}}>3</Text>
                    </View>
                }
                <View className="h-12 w-12 rounded-full border-2 border-white bg-white justify-center items-center">
                    <Animatable.View 
                        ref={circleRef}
                        style={{...StyleSheet.absoluteFillObject}} className="bg-blue-500 rounded-full" 
                    />
                    <Image source={focused ? icon[1] : icon[0]} className={focused ? "w-5 h-5" : "w-8 h-8"}></Image>
                </View> 
                <Animatable.Text
                    ref={textRef}
                    className="text-blue-500 text-center" style={{fontSize:10}}
                >
                    {label}
                </Animatable.Text>
            </Animatable.View>
        </TouchableOpacity>
    )
}

const BottomTabNavigator = () => {
    return (
        <Tab.Navigator
            initialRouteName="Home"
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    height: 70,
                    position: "absolute",
                    bottom: 16,
                    left: 16,
                    right: 16,
                    borderRadius:16
                }
            }}
        >
            <Tab.Screen name="Favorites" component={FavoritesScreen} 
                options={{
                    tabBarShowLabel: false,
                    tabBarButton: (props) => <TabButton {...props} icon={[heartBlue, heart]} label="Favoris" />
                }}
            />
            <Tab.Screen name="Search" component={SearchScreen} 
                options={{
                    tabBarShowLabel: false,
                    tabBarButton: (props) => <TabButton {...props} icon={[search, search]} label="Recherche" />
                }}
            />
            <Tab.Screen name="Home" component={HomeScreen} 
                options={{
                    tabBarShowLabel: false,
                    tabBarButton: (props) => <TabButton {...props} icon={[homeBlue, homeWhite]} label="Accueil" />
                }}
            />
            <Tab.Screen name="Notifications" component={NotificationsScreen} 
                options={{
                    tabBarShowLabel: false,
                    tabBarButton: (props) => <TabButton {...props} icon={[bellBlue, bellWhite]} label="Notifications" />
                }}
            />
            <Tab.Screen name="Settings" component={SettingsScreen} 
                options={{
                    tabBarShowLabel: false,
                    tabBarButton: (props) => <TabButton {...props} icon={[gearBlue, gearWhite]} label="Réglages" />
                }}
            />
        </Tab.Navigator>
    )
}

export default BottomTabNavigator