import Optimization, { OptimizationNavigationContainer, OptimizationRoot } from '@contentful/optimization-react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import client from './src/contentfulClient';
import { createOptimizationInstance } from './src/optimizationClient';
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
  const [optimization, setOptimization] = useState<Optimization | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    createOptimizationInstance()
      .then(setOptimization)
      .catch((err) => {
        console.error('Failed to initialize Optimization SDK:', err);
        setInitError(err.message ?? 'Optimization SDK init failed');
      });
  }, []);

  if (initError) {
    return (
      <SafeAreaProvider>
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>Optimization SDK Error</Text>
          <Text style={styles.errorDetail}>{initError}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!optimization) {
    return (
      <SafeAreaProvider>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0070F3" />
          <Text style={styles.loadingText}>Initializing SDK…</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <OptimizationRoot
        instance={optimization}
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

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 4,
  },
  errorDetail: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
