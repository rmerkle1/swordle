import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Image, ActivityIndicator, View } from 'react-native';
import { RootStackParamList, BottomTabParamList } from '../types';
import { COLORS } from '../constants/theme';
import { UI_IMAGES } from '../assets';
import { usePlayerStore } from '../store/playerStore';
import WelcomeScreen from '../screens/WelcomeScreen';
import BattleScreen from '../screens/BattleScreen';
import ExploreScreen from '../screens/HomeScreen';
import GameScreen from '../screens/GameScreen';
import CreateGameScreen from '../screens/CreateGameScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

const TAB_ICONS: Record<string, any> = {
  Battle: UI_IMAGES.tabBattle,
  Explore: UI_IMAGES.tabExplore,
  Profile: UI_IMAGES.tabProfile,
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Image
      source={TAB_ICONS[label]}
      style={{ width: 24, height: 24, opacity: focused ? 1 : 0.5 }}
    />
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: 'rgba(255,255,255,0.1)',
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Battle" component={BattleScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { initialized, needsRegistration, loadPlayer } = usePlayerStore();

  useEffect(() => {
    loadPlayer();
  }, []);

  if (!initialized) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      {needsRegistration ? (
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Game"
            component={GameScreen}
            options={{ title: 'Swordle' }}
          />
          <Stack.Screen
            name="CreateGame"
            component={CreateGameScreen}
            options={{ title: 'Create Game' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
