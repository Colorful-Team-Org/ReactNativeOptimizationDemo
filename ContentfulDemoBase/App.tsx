import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BlogPostDetailScreen from './src/screens/BlogPostDetailScreen';
import HomeScreen from './src/screens/HomeScreen';

type RootStackParamList = {
  Home: undefined;
  BlogPostDetail: { postId: string; postTitle: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            headerLargeTitle: false,
            headerTransparent: true,
            headerTitle: '',
            contentStyle: {
              backgroundColor: '#ffffff',
            },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
          />
          <Stack.Screen
            name="BlogPostDetail"
            component={BlogPostDetailScreen}
            options={({ route }) => ({
              headerShown: true,
              headerTransparent: false,
              headerLargeTitle: false,
              title: (route.params as any)?.postTitle ?? 'Blog Post',
              headerStyle: { backgroundColor: '#ffffff' },
              headerTintColor: '#0070F3',
              headerTitleStyle: { fontWeight: '700', fontSize: 18 },
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
            })}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
