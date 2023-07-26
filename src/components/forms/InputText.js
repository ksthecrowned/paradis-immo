import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'

const InputText = ({ placeholder, name, keyboardType, multiline, numberOfLines }) => {
    const [value, setValue] = useState('')
    const [focusClasses, setFocusClasses] = useState('')

    return (
        <View className="pb-4">
            <TextInput
                name={name}
                placeholder={placeholder}
                value={value}
                keyboardType={keyboardType}
                multiline={multiline}
                numberOfLines={numberOfLines}
                // maxLength={10}
                onFocus={() => {setFocusClasses('border-blue-500')}}
                onBlur={() => {setFocusClasses('')}}
                onChangeText={(text) => {setValue(text)}}
                className={("text-base border border-gray-200 bg-gray-50 p-4 flex-1 rounded-xl ") + focusClasses}
            />
        </View>
    )
}

export default InputText