import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { ActivityIndicator, View, Text } from 'react-native';

import { supabase } from './src/lib/supabase';
import { RootStackParamList, BottomTabParamList } from './src/types';

import LoginScreen           from './src/screens/LoginScreen';
import { RegisterScreen }   from './src/screens/RegisterScreen';
import { PendingApprovalScreen } from './src/screens/PendingApprovalScreen';
import JobListScreen        from './src/screens/JobListScreen';
import JobDetailScreen      from './src/screens/JobDetailScreen';
import JobMapScreen         from './src/screens/JobMapScreen';
import ProfileScreen        from './src/screens/ProfileScreen';
import TimeOffScreen        from './src/screens/TimeOffScreen';

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
            Jobs:    'list',
            Map:     'map',
            TimeOff: 'calendar',
            Profile: 'person',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Jobs"    component={JobListScreen} options={{ title: 'Jobs' }} />
      <Tab.Screen name="Map"     component={JobMapScreen}  options={{ title: 'Map' }} />
      <Tab.Screen name="TimeOff" component={TimeOffScreen} options={{ title: 'Time Off' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [surveyorStatus, setSurveyorStatus] = useState<'pending' | 'active' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let timeout: any;

    const initAuth = async () => {
      timeout = setTimeout(() => {
        if (mounted) {
          console.log('Session check timeout');
          setLoading(false);
        }
      }, 5000);

      try {
        console.log('Getting session...');
        const result = await supabase.auth.getSession();
        console.log('Session result:', result);
        if (mounted) {
          const { data: { session }, error } = result;
          if (error) {
            console.error('Session error object:', error);
          }
          console.log('Setting session:', session ? 'logged in' : 'not logged in');
          setSession(session || null);
        }
      } catch (err) {
        console.error('Session exception:', err);
      } finally {
        if (mounted) {
          clearTimeout(timeout);
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session || null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setSurveyorStatus(null);
      return;
    }

    const fetchSurveyorStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('surveyors')
          .select('status')
          .eq('user_id', session.user.id)
          .single();

        if (error) {
          console.log('No surveyor profile found:', error.message);
          setSurveyorStatus(null);
          return;
        }

        setSurveyorStatus(data?.status as 'pending' | 'active');
      } catch (err) {
        console.error('Error fetching surveyor status:', err);
        setSurveyorStatus(null);
      }
    };

    fetchSurveyorStatus();
  }, [session]);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#1a3c2e" />
    </View>
  );

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: GREEN },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        {!session
          ? <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          : surveyorStatus === 'pending'
          ? <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} options={{ headerShown: false }} />
          : surveyorStatus === 'active'
          ? <>
              <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job Detail' }} />
            </>
          : <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        }
      </Stack.Navigator>
    </NavigationContainer>
  );
}
