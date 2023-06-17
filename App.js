import { StatusBar } from 'expo-status-bar'
import { Text, View, Image } from 'react-native'
import {NavigationContainer} from '@react-navigation/native'

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
import HomeScreen from './src/screens/HomeScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import EditProfileScreen from './src/screens/EditProfileScreen'
import AuthScreen from './src/screens/AuthScreen'
import SearchScreen from './src/screens/SearchScreen'
import PropertyScreen from './src/screens/PropertyScreen'
import AddPropertyScreen from './src/screens/AddPropertyScreen'
import FavoritesScreen from './src/screens/FavoritesScreen'
import NotificationsScreen from './src/screens/NotificationsScreen'
import CreateAlertScreen from './src/screens/CreateAlertScreen'


import homeBlue from './assets/navicons/home-blue.png'
import alertBlue from './assets/navicons/alert-blue.png'
import alertWhite from './assets/navicons/alert-white.png'

const DrawerNavigation = () => {
	return (
		<Drawer.Navigator drawerContent={(props) => <CustomDrawer {...props} /> } screnOptions={{
			headerShown: false,
			drawerLabelStyle: {
				fontSize: 15,
				fontWeight: 500
			},
			// drawerActiveTintColor: "",
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

const Root = () => {
	return (
		<Stack.Navigator>
			<Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false}} />
			<Stack.Screen name="Ajouter une propriété" component={AddPropertyScreen} options={{ headerShown: false}} />
			<Stack.Screen name="Property" component={PropertyScreen} options={{ headerShown: false}} />
			<Stack.Screen name="Alert Immobillière" component={CreateAlertScreen} options={{ headerShown: false}} />
		</Stack.Navigator>
	)
}

const Profile = () => {
	return (
		<Stack.Navigator>
			<Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false}} />
		</Stack.Navigator>
	)
}

const EditProfile = () => {
	return (
		<Stack.Navigator>
			<Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false}} />
		</Stack.Navigator>
	)
}

export default function App() {
	return (
		// <AuthScreen />
		<GestureHandlerRootView style={{ flex: 1 }}>
			<NavigationContainer>
				{/* <BottomSheetModalProvider>
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
								component={Profile}
								options={{ 
									headerShown: false
								}}
							/>
						</Stack.Group>
					</Stack.Navigator>
				</BottomSheetModalProvider> */}
				<EditProfileScreen />
			</NavigationContainer>
		</GestureHandlerRootView>
	);
}