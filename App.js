import 'react-native-url-polyfill/auto'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { Text, View, Image } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { BottomSheetModalProvider, } from '@gorhom/bottom-sheet'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { createDrawerNavigator } from '@react-navigation/drawer'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

// Import navigators
const Drawer = createDrawerNavigator()
const Stack = createNativeStackNavigator()

// Import components
import BottomTabNavigator from './src/components/BottomTabNavigator'
import CustomDrawer from './src/components/CustomDrawer'

// Import screens
import ProfileScreen from './src/screens/ProfileScreen'
import EditProfileScreen from './src/screens/EditProfileScreen'
import AuthScreen from './src/screens/AuthScreen'
import OnBoarding from './src/screens/OnBoarding'
import PropertyScreen from './src/screens/PropertyScreen'
import AddPropertyScreen from './src/screens/AddPropertyScreen'
import CreateAlertScreen from './src/screens/CreateAlertScreen'

// Import assets
import homeBlue from './assets/navicons/home-blue.png'

import { auth } from './firebase'

import messaging from '@react-native-firebase/messaging'
import AsyncStorage from '@react-native-async-storage/async-storage'

const DrawerNavigation = () => {
	return (
		<Drawer.Navigator drawerContent={(props) => <CustomDrawer {...props} /> } screnOptions={{
			headerShown: false,
			drawerLabelStyle: {
				fontSize: 15,
				fontWeight: 500
			},
		}}>
			<Drawer.Screen name="Accueil" component={BottomTabNavigator} options={{ 
				headerShown: false,
				drawerIcon: ({color}) => {
					return(
						<Image source={homeBlue} className="w-8 h-8"></Image>
					)
				} 
			}} />
		</Drawer.Navigator>
	)
}

export default function App() {
	const [isLoggedIn, setIsLoggedIn] = useState(false)
	const [isFirstOpening, setIsFirstOpening] = useState(false)

	useEffect(() => {
		const checkFirstOpening = async () => {
			try {
				const value = await AsyncStorage.getItem('firstOpening')
				if (value !== 'true') {
					setIsFirstOpening(true)
				}
			} catch (e) {
				console.log(e)
			}
		}

		const unsubscribe = auth.onAuthStateChanged(user => {
			if (user) {
				setIsLoggedIn(true)
			}
		})

		checkFirstOpening()
		return unsubscribe;
	}, [])

	const requestUserPermission = async () => {
		const authStatus = await messaging().requestPermission();
		const enabled =
		  authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
		  authStatus === messaging.AuthorizationStatus.PROVISIONAL;
	  
		if (enabled) {
		  console.log('Authorization status:', authStatus);
		}
	}

	// useEffect(() => {
	// 	if(requestUserPermission()) {
	// 		messaging().getToken().then(token => {
	// 			console.log(token)
	// 		})
	// 	}
	// 	else {
	// 		console.log("Permission denied")
	// 	}


	// 	messaging()
	// 		.getInitialNotification()
	// 		.then(async (remoteMessage) => {
	// 			if (remoteMessage) {
	// 				console.log(
	// 					'Notification caused app to open from quit state:',
	// 					remoteMessage.notification,
	// 				);
	// 			}
	// 		});

	// 	messaging().onNotificationOpenedApp(async (remoteMessage) => {
	// 		console.log(
	// 			'Notification caused app to open from background state:',
	// 			remoteMessage.notification,
	// 		);
	// 	});

	// 	messaging().setBackgroundMessageHandler(async (remoteMessage) => {
	// 		console.log('Message handled in the background!', remoteMessage);
	// 	});


	// 	const unsubscribe = messaging().onMessage(async (remoteMessage) => {
	// 		Alert.alert('A new FCM message arrived!', JSON.stringify(remoteMessage));
	// 	});

	// 	return unsubscribe;
	// }, [])
	
	return (
		<>
			{
				isFirstOpening
				? (
					<OnBoarding />
				)
				: (
					!isLoggedIn 
				
					? <AuthScreen />
					
					: <GestureHandlerRootView style={{ flex: 1 }}>
						<NavigationContainer>
							<BottomSheetModalProvider>
								<Stack.Navigator>
									<Stack.Group>
										<Stack.Screen
											name="Drawer"
											component={DrawerNavigation}
											options={{ 
												headerShown: false
											}}
										/>
									</Stack.Group>
									<Stack.Group>
										<Stack.Screen
											name="Profile"
											component={ProfileScreen}
											options={{ 
												headerShown: false
											}}
										/>
										<Stack.Screen
											name="Property"
											component={PropertyScreen}
											options={{ 
												headerShown: false
											}}
										/>
										<Stack.Screen
											name="AddProperty"
											component={AddPropertyScreen}
											options={{ 
												headerShown: false
											}}
										/>
										<Stack.Screen
											name="EditProfile"
											component={EditProfileScreen}
											options={{ 
												headerShown: false
											}}
										/>
										<Stack.Screen
											name="CreateAlert"
											component={CreateAlertScreen}
											options={{ 
												headerShown: false
											}}
										/>
									</Stack.Group>
								</Stack.Navigator>
							</BottomSheetModalProvider>
						</NavigationContainer>
					</GestureHandlerRootView>	
				)
			}
		</>
	)
}