import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Defs, ClipPath, Path } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

const ParadisRoundedPath = ({ fill, height }: { fill: string, height: number }) => {
  return (
    <View className='flex-1'>
      <Svg height={height} width={screenWidth}>
        <Defs>
          <ClipPath id="clip">
            <Path d={`
              M0 0 
              H${screenWidth} 
              V20 
              A30 30 0 0 1 ${screenWidth - 30} ${height} 
              H30 
              A30 30 0 0 1 0 20 
              Z
            `} />
          </ClipPath>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={screenWidth}
          height={height}
          fill={fill}
          clipPath="url(#clip)"
        />
      </Svg>
    </View>
  );
};

export default ParadisRoundedPath;

{/* <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
  <Defs>
    <ClipPath id="clip-path">
      <Path d={`M0,${height}H${width}V20a30,30,0,0,1-30,15H30A30,30,0,0,1,0,20Z`} />
    </ClipPath>
  </Defs>
  <G transform={`translate(${width} ${height}) rotate(180)`} clipPath="url(#clip-path)">
    <Path
      d={`M0,${height + 1.737}l208.066-1.448L${width},${height + 1.737}V22.429s-6.559,6.992-13.282,10.134A28.812,28.812,0,0,1,${width -
        26.891},35H27.1s-8.282.706-15.057-2.437S0,22.429,0,22.429V${height + 1.737}Z`}
      fill={fill} stroke={fill}
    />
  </G>
</Svg> */}