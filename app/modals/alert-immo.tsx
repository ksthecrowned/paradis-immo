import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, Pressable, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { View } from 'react-native-animatable';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { FadeIn, SlideInDown } from 'react-native-reanimated';

export default function AlertImmoScreen() {
  const screenWidth = Dimensions.get('window').width;
  const sliderWidth = screenWidth - 32;

  const [isVisible, setIsVisible] = useState(true); 
  const translateY = useSharedValue(0); // Position verticale partagée

  // Style animé basé sur la position partagée
  const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
  }));

  // Geste de glissement
  const gesture = Gesture.Pan()
      .onUpdate((event) => {
          // Mettre à jour la position en fonction du mouvement vertical
          translateY.value = Math.max(event.translationY, 0);
      })
      .onEnd(() => {
          // Renvoyer le panneau en place si ce n'est pas assez glissé pour être fermé
          if (translateY.value > 300) {
              translateY.value = withSpring(800, { overshootClamping: true }, () => {
                  // setIsVisible(false);
              });
          } else {
              translateY.value = withSpring(0); // Retour à la position initiale
          }
      });

  if (!isVisible) return null;

  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  return (
    <Animated.View
        entering={FadeIn}
        className="flex-1 items-center justify-end bg-black/40"
    >
        <Link href={'/(tabs)'} asChild onPress={() => setIsVisible(false)}>
            <Pressable style={StyleSheet.absoluteFill} />
        </Link>
        <Animated.View
            entering={SlideInDown.duration(500)}
            style={animatedStyle}
            className="p-4 pt-2 w-full h-[99%] bg-white rounded-t-3xl -mb-20 pb-20"
        >
            <GestureDetector gesture={gesture}>
                <TouchableOpacity className="p-2 mb-2">
                    <View className="w-16 rounded-full mx-auto h-2 bg-gray-800" />
                </TouchableOpacity>
            </GestureDetector>
            <View className="flex-row justify-between items-center">
                <TouchableOpacity
                    onPress={() => {
                        router.back()
                    }}
                    className="rounded-full p-2 bg-blue-100/40"
                >
                    <Ionicons name="close" size={20} color="black" />
                </TouchableOpacity>
                <Text className="text-xl font-bold">Alerte immobilière</Text>
                <View className="opacity-0 w-8" />
            </View>
            <ScrollView 
                showsVerticalScrollIndicator={false}
                className="w-full flex-1 gap-y-5 mt-1 pb-6"
            >
                <View className="rounded-full bg-blue-100/40 p-1 flex-row">
                    <View className="w-1/2 p-3 rounded-full bg-white shadow-lg">
                        <Text className="text-center font-bold">A louer</Text>
                    </View>
                    <View className="w-1/2 p-3 rounded-full">
                        <Text className="text-center font-bold">A vendre</Text>
                    </View>
                </View>
                <View>
                    <Text className="text-lg font-bold">Types de propriété</Text>
                    <View className="flex-row flex-wrap gap-2 mt-2">
                        <View className="flex-row items-center space-x-2 py-3 px-8 rounded-full bg-blue-200">
                            <Text className="text-blue-500">Maison</Text>
                            <Ionicons name="close" size={18} color="#3b82f6" />
                        </View>
                        <View className="py-3 px-8 rounded-full bg-blue-100/40">
                            <Text>Appartement</Text>
                        </View>
                        <View className="py-3 px-8 rounded-full bg-blue-100/40">
                            <Text>Appartement meublé</Text>
                        </View>
                        <View className="flex-row items-center space-x-2 py-3 px-8 rounded-full bg-blue-200">
                            <Text className="text-blue-500">Bureau</Text>
                            <Ionicons name="close" size={18} color="#3b82f6" />
                        </View>
                        <View className="py-3 px-8 rounded-full bg-blue-100/40">
                            <Text>Terrain</Text>
                        </View>
                        <View className="py-3 px-8 rounded-full bg-blue-100/40">
                            <Text>Boutique</Text>
                        </View>
                        <View className="py-3 px-8 rounded-full bg-blue-100/40">
                            <Text>Villa</Text>
                        </View>
                        <View className="py-3 px-8 rounded-full bg-blue-100/40">
                            <Text>Parcelle</Text>
                        </View>
                        <View className="py-3 px-8 rounded-full bg-blue-100/40">
                            <Text>Studio</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
            <View className="my-4">
                <TouchableOpacity
                    onPress={() => {router.push('../search')}}
                    className="rounded-xl bg-blue-500 py-4"
                >
                    <Text className="text-base text-white text-center font-medium">
                        Lancer l'alerte
                    </Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    </Animated.View>
  );
}
