import { View, Text } from 'react-native'
import CheckBox from '@react-native-community/checkbox'
import React, {useState} from 'react'

const HiddenCheckBox = () => {
    const [isSelected, setSelection] = useState(false);

    return (
        <View>
            <View>
                <CheckBox
                    disabled={false}
                    value={isSelected}
                    onValueChange={() => setSelection(!isSelected)}
                />
                <Text>Do you like React Native?</Text>
            </View>
            <View>
                <Text>Is CheckBox selected: {isSelected ? '👍' : '👎'}</Text>
            </View>
        </View>
    )
}

export default HiddenCheckBox