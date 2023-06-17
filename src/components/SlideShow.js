import { View, Text, Dimensions, SafeAreaView, ScrollView, Image, StatusBar } from 'react-native'
import React, { useState } from 'react'
import { SliderBox } from 'react-native-image-slider-box'

import property02 from '../../assets/images/property02.jpg'
import property03 from '../../assets/images/property03.jpg'

const SlideShow = () => {
    const [images, setImages] = React.useState([
        property02,
        property03,
        property02,
    ]);

    return (
        <View>
            <SliderBox 
                images={images}
                sliderBoxHeight={350}
                dotStyle={{width: 17,height: 17,borderRadius: 10,marginHorizontal: 0,padding: 0,marginBottom: 0,} }
                dotColor="rgb(59, 130, 246)"
                imageLoadingColor="rgb(59, 130, 246)"
                inactiveDotColor="#90A4AE"
                paginationBoxVerticalPadding={40}
                onCurrentImagePressed={index => console.warn(`image ${index} pressed`)}
                // paginationBoxVerticalPadding={20}
                // autoplay
                // circleLoop
            />
            <StatusBar />
        </View>
    );
}

export default SlideShow