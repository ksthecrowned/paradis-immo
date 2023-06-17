import { View, Text } from 'react-native'
import { CheckBox, Icon } from '@rneui/themed'
import React, { useState } from 'react'

const baseStyle = {
    fontSize:15,
    fontWeight:500,
    color:"#333"
}
const selectedStyle = {
    color: "#fff"
}

const CheckBoxItem = ({ title }) => {
    const [isSelected, setSelection] = useState(false);

    return (
        <View className={"border border-gray-200 rounded-full" + (isSelected ? ' bg-blue-500' : ''  )}>
            <CheckBox
                center
                title={title}
                size={20}
                containerStyle={{
                    paddingVertical:5,
                    paddingHorizontal:5,
                    backgroundColor:"transparent"
                }}
                textStyle={[baseStyle, isSelected ? selectedStyle : ""]}
                iconType="material"
                checkedIcon="clear"
                uncheckedIcon="add"
                checkedColor="white"
                checked={isSelected}
                onPress={() => setSelection(!isSelected)}
            />
        </View>
    )
}

const CategoriesList = () => {    

    return (
        <View className="flex-row flex-wrap pt-4">
            <View className="mr-2 mb-2">
                <CheckBoxItem title="Maison" />
            </View>
            <View className="mr-2 mb-2">
                <CheckBoxItem title="Appartement" />
            </View>
            <View className="mr-2 mb-2">
                <CheckBoxItem title="Studio" />
            </View>
            <View className="mr-2 mb-2">
                <CheckBoxItem title="Bureau" />
            </View>
            <View className="mr-2 mb-2">
                <CheckBoxItem title="Villa" />
            </View>
        </View>
    )
}

export default CategoriesList