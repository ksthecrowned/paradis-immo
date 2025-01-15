import React, { useState } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";

const GOOGLE_API_KEY = "VOTRE_CLE_API_GOOGLE";

const GoogleMapSearch = () => {
    const [region, setRegion] = useState({
        latitude: -4.2634, // Exemple : Brazzaville
        longitude: 15.2429,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    });

    return (
        <View style={styles.container}>
            <GooglePlacesAutocomplete
                placeholder="Rechercher un lieu"
                query={{
                    key: GOOGLE_API_KEY,
                    language: "fr", // Langue du résultat
                }}
                onPress={(data, details = null) => {
                    console.log(data, details);
                    const { lat, lng } = details?.geometry?.location || {};
                    if (lat && lng) {
                        setRegion({
                            latitude: lat,
                            longitude: lng,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        });
                    }
                }}
                fetchDetails={true}
                styles={{
                    container: styles.searchContainer,
                    textInput: styles.textInput,
                }}
            />
            
            <MapView style={styles.map} region={region}>
                <Marker coordinate={region} title="Position sélectionnée" />
            </MapView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: "relative",
        height: 200,
    },
    map: {
        width: Dimensions.get("window").width,
        height: Dimensions.get("window").height,
    },
    searchContainer: {
        position: "absolute",
        top: 0,
        width: "98%",
        alignSelf: "center",
        backgroundColor: "white",
        borderRadius: 8,
        padding: 8,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    textInput: {
        height: 40,
        borderRadius: 5,
        paddingHorizontal: 10,
        fontSize: 16,
    },
});

export default GoogleMapSearch;
