import { StatusBar, Text, TouchableOpacity, View, Image, ImageBackground } from "react-native";
import React from "react";
import { Stack, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FlipInXUp } from "react-native-reanimated";

type Props = {};

const WelcomeScreen = () => {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={'dark-content'}
      />
      <View className="flex-1 bg-white">
        <ImageBackground
          source={require("@/assets/images/welcome-bg.png")}
          className="flex-1 bg-blue-500"
        >
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 1)']}
            className="absolute top-0 left-0 w-full h-full items-center justify-end p-8"
          >
            <Animated.Image
              source={require("@/assets/logos/paradis-logo.png")}
              className="w-52 h-52"
              entering={FlipInXUp.delay(500).duration(1000).springify(2000)}
            />
          </LinearGradient>
        </ImageBackground>
        <View className="p-5 bg-white pb-14">
          <View className="m-4">
            <Text className="font-medium text-2xl text-center">Le paradis de l'immobilier</Text>
            <Text className="font-medium text-center mt-4">Ne cherchez plus, trouvez le bien Immobilier qui vous correspond le mieux en quelques cliques.</Text>
          </View>
          <View className="">
            <TouchableOpacity
              onPress={() => router.push("/signin")}
              className="rounded-xl bg-blue-500 py-4"
            >
              <Text className="text-base text-white text-center font-medium">Se connecter</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center justify-center space-x-2 mt-4">
            <Text>Vous n'avez pas de compte ?</Text>
            <TouchableOpacity onPress={() => router.push("/signup")}>
              <Text className="text-center font-medium text-blue-500">S'inscrire</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </>
  );
};

export default WelcomeScreen;


// import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
// import React from "react";
// import { Link, Stack } from "expo-router";
// import { LinearGradient } from "expo-linear-gradient";

// type Props = {};

// const WelcomeScreen = (props: Props) => {
//   return (
//     <>
//       <Stack.Screen options={{ headerShown: false }} />
//       <ImageBackground
//         source={require("@/assets/images/small-red-house-in-nature.jpeg")}
//         style={{ flex: 1 }}
//         resizeMode="cover"
//       >
//         <View className="flex-1 items-center justify-center">
//           <LinearGradient 
//             colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.9)"]} 
//             className="absolute inset-0 w-full h-full items-center justify-end p-8 pb-20"
//           >
//             <Text className="text-white font-medium text-2xl text-center">Our repulation is an solid as concrete.</Text>
//             <Text className="text-white font-medium text-center my-4">Vous trouverez ici toutes les informations sur nos biens immobiliers.</Text>
//             <TouchableOpacity className="bg-white p-4 w-full rounded-full mt-4">
//               <Text className="text-gray-800 font-bold text-base text-center">S'inscrire</Text>  
//             </TouchableOpacity>  
//             <View className="flex-row gap-1 mt-6">
//               <Text className="text-white font-medium text-center">Vous avez déjà un compte ?</Text>
//               <Link href="/signin" asChild>
//                 <TouchableOpacity>
//                   <Text className="text-red-500 font-medium text-center">Se connecter</Text>
//                 </TouchableOpacity>
//               </Link>
//             </View>
//           </LinearGradient> 
//         </View>
//       </ImageBackground>
//     </>
//   );
// };

// export default WelcomeScreen;
