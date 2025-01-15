import React from "react";
import { Image, View } from "react-native";

export default function Onboarding() {
  return (
    <View className="relative">
      <Image source={require('@/assets/images/Appartement-Loue-a-Vendre-.jpeg')} />
      <View className="absolute top-0 left-0 w-full h-full bg-black/50"></View>
    </View>
  );
}