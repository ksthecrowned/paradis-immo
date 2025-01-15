import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";

export default function HomeSearchInput() {
    return (
        <View className='flex-row items-center space-x-2 border border-blue-500/10 rounded-lg px-3 py-2.5'>
            <TouchableOpacity>
                <Ionicons name='search' size={24} />
            </TouchableOpacity>
            <TextInput 
                className='flex-1 text-gray-600'
            />
            <TouchableOpacity>
                <Ionicons name='filter' size={24} />
            </TouchableOpacity>
        </View>
    )
}