import { View, Text, ImageBackground, Image, FlatList, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'
import {
    DrawerContentScrollView,
    DrawerItemList,
    DrawerItem
  } from '@react-navigation/drawer'
import { useNavigation } from '@react-navigation/native'

import CreateAlertScreen from '../screens/CreateAlertScreen'

import PropertyScreen from '../../src/screens/PropertyScreen'
import property03 from '../../assets/images/property03.jpg'
import corniche from '../../assets/images/corniche.jpg'
import alertBlue from '../../assets/navicons/alert-blue.png'
import alertWhite from '../../assets/navicons/alert-white.png'

import accountBlue from '../../assets/drawericons/account-blue.png'
import accountWhite from '../../assets/drawericons/account-white.png'
import questionBlue from '../../assets/drawericons/question-blue.png'
import questionWhite from '../../assets/drawericons/question-white.png'
import shareBlue from '../../assets/drawericons/share-blue.png'
import shareWhite from '../../assets/drawericons/share-white.png'
import addCircleOutlineBlue from '../../assets/drawericons/add-circle-outline-blue.png'
import addCircleOutlineWhite from '../../assets/drawericons/add-circle-outline-white.png'

const MenuItem = ({ item, activeElement, setActiveElement, navigation }) => {
    const onPress = () => {
        setActiveElement(item.title)
        // navigation.navigate('Root', {
        //     screen: item.component
        // })
    }
    return (
        <TouchableOpacity onPress={onPress} className={"py-1.5 px-3 my-1 rounded-md mx-4 flex-row items-center " + (activeElement == item.title ? ' bg-blue-500' : '')}>
            <Image source={activeElement == item.title ? item.activeIcon : item.inActiveIcon} className="h-8 w-8 rounded-full" />
            <Text className={"text-base ml-5" + (activeElement == item.title ? ' text-white' : '')}>{item.title}</Text>
        </TouchableOpacity>
    )
}

const CustomDrawer = (props) => {
    const [activeElement, setActiveElement] = useState("Accueil")
    const navigation = useNavigation()

    const menuItems = [
        {
            activeIcon: alertWhite, 
            inActiveIcon: alertBlue,
            component: 'CreateAlertScreen',
            title: 'Accueil'
        },
        {
            activeIcon: accountWhite, 
            inActiveIcon: accountBlue,
            component: 'CreateAlertScreen',
            title: 'Profile'
        },
        {
            activeIcon: alertWhite, 
            inActiveIcon: alertBlue,
            component: 'CreateAlertScreen',
            title: 'Notifications'
        },
        {
            activeIcon: alertWhite, 
            inActiveIcon: alertBlue,
            component: 'CreateAlertScreen',
            title: 'Mes alertes'
        },
        {
            activeIcon: alertWhite, 
            inActiveIcon: alertBlue,
            component: 'CreateAlertScreen',
            title: 'Messages'
        },
        {
            activeIcon: addCircleOutlineWhite, 
            inActiveIcon: addCircleOutlineBlue,
            component: 'CreateAlertScreen',
            title: 'Alerte immobillière'
        },
        {
            activeIcon: alertWhite, 
            inActiveIcon: alertBlue,
            component: 'CreateAlertScreen',
            title: 'A propos'
        }
    ]

    const bottomMenuItems = [
        {
            activeIcon: shareWhite, 
            inActiveIcon: shareBlue,
            component: 'CreateAlertScreen',
            title: 'Partager l\'application'
        },
        {
            activeIcon: questionWhite, 
            inActiveIcon: questionBlue,
            component: 'CreateAlertScreen',
            title: 'Centre d\'aide'},
    ]

    return (
        <View className="flex-1">
            <View style={{flex: 0.25}} className="pt-10 pb-3 px-5 border-b border-gray-200 bg-blue-500">
                <Image source={property03} className="h-24 w-24 rounded-full" />
                <Text className="font-bold text-2xl mt-4 text-white">Kaiser D. Styve</Text>
                <Text className="text-base mt-1.5 text-white">{`60 followers`}</Text>
            </View>
            <View style={{flex: 0.60}} className="border-b border-gray-200 my-3">
                <FlatList
                    data={menuItems}
                    renderItem={
                        ({ item }) => <MenuItem 
                                        item={item} 
                                        activeElement={activeElement} 
                                        setActiveElement={setActiveElement} 
                                        navigation={navigation}
                                        />
                    }
                    // keyExtractor={item => item.id}
                />
            </View>
            <View style={{flex: 0.15}}>
                <FlatList
                    data={bottomMenuItems}
                    renderItem={
                        ({ item }) => <MenuItem 
                                        item={item} 
                                        activeElement={activeElement} 
                                        setActiveElement={setActiveElement} 
                                        navigation={navigation}
                                        />
                    }
                    // keyExtractor={item => item.id}
                />
            </View>
            {/* <DrawerContentScrollView {...props} contentContainerStyle={{backgroundColor: "rgb(59, 130, 246)"  }}>
                <View className="p-5 bg-blue-500">
                    <Image source={property03} className="w-20 h-20 rounded-full mt-5" />
                    <Text className="text-white text-lg font-medium">John Doe</Text>
                    <Text className="text-white">View Profile</Text>
                </View>
                <View className="flex-1 bg-white pt-3">
                    <DrawerItemList {...props} />
                </View>
            </DrawerContentScrollView> */}
        </View>
    )
}

export default CustomDrawer