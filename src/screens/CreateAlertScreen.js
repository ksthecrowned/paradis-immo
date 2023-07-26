import { View, Text, SafeAreaView, ScrollView } from 'react-native'
import SecondaryTopMenu from "../components/SecondaryTopMenu"
import NestedPageTitle from "../components/NestedPageTitle"

import Filters from '../components/Filters'
import AdvancedSearchForm from '../components/AdvancedSearchForm'

const page_title = "Alerte immobilière"
const description = "Créez une alerte immobilière et soyez notifié quand une propriété ayant vos critères sera publiée."

const CreateAlertScreen = () => {
    return (
        <SafeAreaView className="flex-1">
            
            {/* Top Menu */}
            <SecondaryTopMenu statusBarStyle={'light-content'} screen={'notifications'} />

            <ScrollView>
                <NestedPageTitle
                    title={page_title}
                    description={description}
                />
                <View className="bg-white pt-4">
                    <AdvancedSearchForm actionText="Créer l'alerte" />
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

export default CreateAlertScreen