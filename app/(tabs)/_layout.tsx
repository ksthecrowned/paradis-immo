import { router, Tabs } from 'expo-router';
import React from 'react';

import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { Colors } from '@/constants/Colors';
import TabButton from '@/components/navigation/TabButton';

export default function TabLayout() {
  const colorScheme = "dark";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarStyle: {
          height: 70,
          position: "absolute",
          bottom: 16,
          left: 16,
          right: 16,
          marginHorizontal: 10,
          borderRadius:16,
          backgroundColor: Colors[colorScheme ?? 'light'].tint,
          shadowColor: 'rgb(59, 130, 246)',
      }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarShowLabel: false,
          tabBarButton: (props) => 
            <TabButton 
              label='Accueil' {...props}
              icon={[
                <TabBarIcon name={'home-outline'} color={"#3b82f6"} size={26} />, 
                <TabBarIcon name={'home'} color={"#FFF"} />
              ]} 
            />          
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarShowLabel: false,
          tabBarButton: (props) => 
            <TabButton 
              label='Explorer' {...props}
              icon={[
                <TabBarIcon name={'compass-outline'} color={"#3b82f6"} size={30} />, 
                <TabBarIcon name={'compass'} color={"#FFF"} />
              ]} 
            />          
        }}
      />
      <Tabs.Screen
        name="alert"
        options={{
          tabBarShowLabel: false,
          tabBarButton: (props) => 
            <TabButton 
              label='Alerte immo' {...props}
              onPress={() => 
                router.push('../modals/alert-immo')
              }
              icon={[
                <TabBarIcon name={'add-circle-outline'} color={"#3b82f6"} size={30} />, 
                <TabBarIcon name={'add-circle'} color={"#FFF"} />
              ]} 
            />          
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          tabBarShowLabel: false,
          tabBarButton: (props) => 
            <TabButton 
              label='Favoris' {...props}
              icon={[
                <TabBarIcon name={'heart-outline'} color={"#3b82f6"} size={30} />, 
                <TabBarIcon name={'heart'} color={"#FFF"} />
              ]} 
            />          
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarShowLabel: false,
          tabBarButton: (props) => 
            <TabButton 
              label='Profil' {...props}
              icon={[
                <TabBarIcon name={'person-outline'} color={"#3b82f6"} size={26} />, 
                <TabBarIcon name={'person'} color={"#FFF"} />
              ]} 
            />          
        }}
      />
    </Tabs>
  );
}
