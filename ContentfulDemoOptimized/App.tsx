import { OptimizationNavigationContainer, OptimizationRoot } from '@contentful/optimization-react-native';
import { OPTIMIZATION_CLIENT_ID, OPTIMIZATION_ENVIRONMENT } from '@env';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import client from './src/contentfulClient';
import BlogPostDetailScreen from './src/screens/BlogPostDetailScreen';
import HomeScreen from './src/screens/HomeScreen';

type RootStackParamList = {
  Home: undefined;
  BlogPostDetail: { postId: string; postTitle: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Toggle this to show/hide the preview panel FAB
const ENABLE_PREVIEW_PANEL = true;

export default function App() {
  return (
    <SafeAreaProvider>
      <OptimizationRoot
        clientId={OPTIMIZATION_CLIENT_ID}
        environment={OPTIMIZATION_ENVIRONMENT}
        logLevel={__DEV__ ? 'info' : 'warn'}
        defaults={{ consent: true }}
        previewPanel={{
          enabled: ENABLE_PREVIEW_PANEL,
          contentfulClient: client,
        }}
      >
        <OptimizationNavigationContainer>
          {(navigationProps) => (
            <NavigationContainer {...(navigationProps as any)}>
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
          )}
        </OptimizationNavigationContainer>
      </OptimizationRoot>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

