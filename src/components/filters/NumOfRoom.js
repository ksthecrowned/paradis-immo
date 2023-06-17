import { View, Text, Image } from 'react-native'
import { CheckBox, Icon } from '@rneui/themed'
import React, { useState } from 'react'

import buyProperty from '../../../assets/icons/buy-property.png'

const baseStyle = {
    fontSize:15,
    fontWeight:500,
    color:"#333"
}
const selectedStyle = {
    color: "#fff"
}

const CheckBoxItem = ({ label, value, selectedIndex, setIndex, iconInactive, iconActive }) => {
    return (
        <View className={"border border-gray-200 rounded-full" + (selectedIndex == value ? ' bg-blue-500' : '')}>
            <CheckBox
                center
                title={label}
                size={20}
                iconRight
                containerStyle={{
                    paddingVertical:5,
                    paddingHorizontal:5,
                    backgroundColor:"transparent"
                }}
                textStyle={[baseStyle, selectedIndex == value ? selectedStyle : ""]}
                iconType="material"
                checkedIcon={
                    <Image className="h-4 w-4" source={iconActive}></Image>
                }
                uncheckedIcon={
                    <Image className="h-4 w-4" source={iconInactive}></Image>
                }
                checkedColor="white"
                checked={selectedIndex == value ? true : false}
                onPress={() => setIndex(value)}
            />
        </View>
    )
}

const NumOfRoom = ({ iconInactive, iconActive  }) => {
    const [selectedIndex, setIndex] = useState(0);

    return (
        <View className="flex-row flex-wrap mt-2">
            <View className="mr-2 mb-2">
                <CheckBoxItem 
                setIndex={setIndex} 
                selectedIndex={selectedIndex} 
                value={1} label="1" 
                iconInactive={iconInactive}
                iconActive={iconActive}
            />
            </View>
            <View className="mr-2 mb-2">
                <CheckBoxItem 
                setIndex={setIndex} 
                selectedIndex={selectedIndex} 
                value={2} label="2" 
                iconInactive={iconInactive}
                iconActive={iconActive}
            />
            </View>
            <View className="mr-2 mb-2">
                <CheckBoxItem 
                setIndex={setIndex} 
                selectedIndex={selectedIndex} 
                value={3} label="plus de 2" 
                iconInactive={iconInactive}
                iconActive={iconActive}
            />
            </View>
            <View className="mr-2 mb-2">
                <CheckBoxItem 
                setIndex={setIndex} 
                selectedIndex={selectedIndex} 
                value={4} label="plus de 3" 
                iconInactive={iconInactive}
                iconActive={iconActive}
            />
            </View>
            <View className="mr-2 mb-2">
                <CheckBoxItem 
                setIndex={setIndex} 
                selectedIndex={selectedIndex} 
                value={5} label="plus de 4" 
                iconInactive={iconInactive}
                iconActive={iconActive}
            />
            </View>
        </View>
    )
}

export default NumOfRoom