import { View, Text, TextInput, Image, TouchableOpacity } from 'react-native'
import React, { useRef, useMemo, useCallback } from 'react'
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'

import AdvancedSearchForm from "../components/AdvancedSearchForm"
import CustomBackdrop from "../components/CustomBackdrop"

import search from '../../assets/icons/search.png'
import equalizer from '../../assets/icons/equalizer.png'


const SearchForm = () => {

    // ref
    const bottomSheetModalRef = useRef(null);

    // variables
    const snapPoints = useMemo(() => ["90%"], []);

    // callbacks
    const handlePresentModalPress = useCallback(() => {
        bottomSheetModalRef.current?.present();
    }, []);
    const handleSheetChanges = useCallback((index: number) => {
        console.log('handleSheetChanges', index);
    }, []);

    return (
        <View>
            <View className="pt-8 justify-between flex-row gap-2 relative">
                <TextInput
                    inlineImageLeft='search_icon'
                    placeholder="Search for a location"
                    editable
                    value=""
                    className="flex-1 rounded-lg bg-white py-2 pl-11 pr-4"
                />
                <View className="absolute top-10 pt-0.5 left-2">
                    <Image source={search} className="w-7 h-7"></Image>
                </View>
                <TouchableOpacity onPress={handlePresentModalPress} className="h-12 w-12 bg-white rounded-lg items-center justify-center">
                    <Image source={equalizer} className="w-7 h-7"></Image>
                </TouchableOpacity>
            </View>
            {/* Filters BootmSheet */}
            <BottomSheetModal
                ref={bottomSheetModalRef}
                index={0}
                snapPoints={snapPoints}
                backdropComponent={(props) => <CustomBackdrop {...props} />}
                onChange={handleSheetChanges}
            >
                <BottomSheetScrollView>
                    <AdvancedSearchForm title="Filtres" actionText="Appliquer les filtres" />
                </BottomSheetScrollView>
            </BottomSheetModal>
        </View>
    )
}

export default SearchForm