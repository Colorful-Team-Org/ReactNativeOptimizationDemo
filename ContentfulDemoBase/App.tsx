import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import BlogPostDetailScreen from './src/screens/BlogPostDetailScreen';

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
            headerStyle: {
              backgroundColor: '#ffffff',
            },
            headerTintColor: '#0070F3',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
            },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: {
              backgroundColor: '#ffffff',
            },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: 'Contentful Demo',
              headerLargeTitle: true,
            }}
          />
          <Stack.Screen
            name="BlogPostDetail"
            component={BlogPostDetailScreen}
            options={({ route }) => ({
              title: (route.params as any)?.postTitle ?? 'Blog Post',
            })}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
