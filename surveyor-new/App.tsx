import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';

import { supabase } from './src/lib/supabase';
import { RootStackParamList, BottomTabParamList } from './src/types';

import LoginScreen     from './src/screens/LoginScreen';
import JobMapScreen    from './src/screens/JobMapScreen';
import JobListScreen   from './src/screens/JobListScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import ProfileScreen   from './src/screens/ProfileScreen';
import TimeOffScreen   from './src/screens/TimeOffScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<BottomTabParamList>();

const GREEN = '#1a3c2e';

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: GREEN },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: GREEN,
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Map:     'map',
            Jobs:    'list',
            TimeOff: 'calendar',
            Profile: 'person',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Map"     component={JobMapScreen}  options={{ title: 'Job Map' }} />
      <Tab.Screen name="Jobs"    component={JobListScreen} options={{ title: 'Jobs' }} />
      <Tab.Screen name="TimeOff" component={TimeOffScreen} options={{ title: 'Time Off' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: GREEN },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        {session
          ? <>
              <Stack.Screen name="Main"      component={MainTabs}       options={{ headerShown: false }} />
              <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job Detail' }} />
            </>
          : <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        }
      </Stack.Navigator>
    </NavigationContainer>
  );
}
