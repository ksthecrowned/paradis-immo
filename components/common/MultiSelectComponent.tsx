import React, { useState } from 'react';
  import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
  import { MultiSelect } from 'react-native-element-dropdown';
  import AntDesign from '@expo/vector-icons/AntDesign';
import { Ionicons } from '@expo/vector-icons';

  const MultiSelectComponent = ({ data, placeholder, iconName }: any) => {
    const [selected, setSelected] = useState<string[]>([]);

    const renderItem = (item: { label: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined; }) => {
      return (
        <View style={styles.item}>
          <Text style={styles.selectedTextStyle}>{item.label}</Text>
          <Ionicons name={iconName} color={"gray"} size={20} />
        </View>
      );
    };

    return (
      <View className=''>
        <MultiSelect
          style={styles.dropdown}
          placeholderStyle={styles.placeholderStyle}
          selectedTextStyle={styles.selectedTextStyle}
          inputSearchStyle={styles.inputSearchStyle}
          iconStyle={styles.iconStyle}
          data={data}
          labelField="label"
          valueField="label" // value
          placeholder={placeholder}
          value={selected}
          search
          searchPlaceholder="Chercher ici..."
          onChange={item => {
            setSelected(item);
          }}
          renderLeftIcon={() => (
            <Ionicons style={styles.icon} name={iconName} color={"gray"} size={20} />
          )}
          renderItem={renderItem}
          renderSelectedItem={(item, unSelect) => (
            <TouchableOpacity onPress={() => unSelect && unSelect(item)}>
              <View style={styles.selectedStyle}>
                <Text style={styles.textSelectedStyle}>{item.label}</Text>
                <Ionicons name='close' color={"white"} size={17} />
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  export default MultiSelectComponent;

  const styles = StyleSheet.create({
    dropdown: {
      height: 50,
      backgroundColor: 'white',
      borderRadius: 8,
      padding: 12,
      shadowColor: 'rgb(59, 130, 246)',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,

      elevation: 2,
    },
    placeholderStyle: {
      fontSize: 16,
      color: 'gray',
    },
    selectedTextStyle: {
      fontSize: 14,
    },
    iconStyle: {
      width: 20,
      height: 20,
    },
    inputSearchStyle: {
      height: 40,
      fontSize: 16,
    },
    icon: {
      marginRight: 5,
    },
    item: {
      padding: 17,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    selectedStyle: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: 'rgb(59, 130, 246)',
      shadowColor: '#000',
      marginTop: 8,
      marginRight: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      // shadowOffset: {
      //   width: 0,
      //   height: 1,
      // },
      // shadowOpacity: 0.2,
      // shadowRadius: 1.41,

      // elevation: 2,
    },
    textSelectedStyle: {
      marginRight: 5,
      fontSize: 16,
      color: 'white',
    },
  });