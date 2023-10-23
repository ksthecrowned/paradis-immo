import 'react-native-url-polyfill/auto'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { Text, View, Image, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { BottomSheetModalProvider, } from '@gorhom/bottom-sheet'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { createDrawerNavigator } from '@react-navigation/drawer'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import AsyncStorage from '@react-native-async-storage/async-storage'

// Import navigators
const Drawer = createDrawerNavigator()
const Stack = createNativeStackNavigator()

// Import components
import BottomTabNavigator from './src/components/BottomTabNavigator'
import CustomDrawer from './src/components/CustomDrawer'
import OnBoarding from './src/components/OnBoarding'

// Import screens
import ProfileScreen from './src/screens/ProfileScreen'
import EditProfileScreen from './src/screens/EditProfileScreen'
import AuthScreen from './src/screens/AuthScreen'
import PropertyScreen from './src/screens/PropertyScreen'
import AddPropertyScreen from './src/screens/AddPropertyScreen'
import CreateAlertScreen from './src/screens/CreateAlertScreen'

// Import assets
import homeBlue from './assets/navicons/home-blue.png'

import { auth } from './firebase'

const Loading = () => {
	<View>
		<ActivityIndicator size={large} />
	</View>
}

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
	const [isLoading, setIsLoading] = useState(false)
	const [viewedOnboarding, setViewedOnboarding] = useState(false)
	const [isLoggedIn, setIsLoggedIn] = useState(false)

	const checkOnboarding = async () => {
		try {
			const value = await AsyncStorage.getItem('@viewedOnboarding')

			if(value !== null) {
				setViewedOnboarding(true)
			}
		} catch (error) {
			console.log('Err @checkOnboarding: ', error)
		} finally {
			setViewedOnboarding(false)
		}
	}

	useEffect(() => {
		checkOnboarding()

        const unsubscribe = auth.onAuthStateChanged(user => {
            if(user) {
                setIsLoggedIn(true)
            }
        })

		return unsubscribe
    }, [])
	
	return (
		<>
		{isLoading ? <Loading /> : viewedOnboarding ? <AuthScreen /> : <OnBoarding /> }
			{/* {
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
			} */}
		</>
	)
}