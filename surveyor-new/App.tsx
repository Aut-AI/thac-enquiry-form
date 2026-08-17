import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { ActivityIndicator, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { supabase } from './src/lib/supabase';
import { RootStackParamList, BottomTabParamList } from './src/types';

import LoginScreen           from './src/screens/LoginScreen';
import { RegisterScreen }   from './src/screens/RegisterScreen';
import { PendingApprovalScreen } from './src/screens/PendingApprovalScreen';
import { CompleteProfileScreen } from './src/screens/CompleteProfileScreen';
import JobListScreen        from './src/screens/JobListScreen';
import JobDetailScreen      from './src/screens/JobDetailScreen';
import JobMapScreen         from './src/screens/JobMapScreen';
import ProfileScreen        from './src/screens/ProfileScreen';
import CoverageAreaScreen   from './src/screens/CoverageAreaScreen';
import InsuranceScreen      from './src/screens/InsuranceScreen';
import AvailabilityScreen   from './src/screens/AvailabilityScreen';

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
            Profile: 'person',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Jobs"    component={JobListScreen} options={{ title: 'Jobs' }} />
      <Tab.Screen name="Map"     component={JobMapScreen}  options={{ title: 'Map' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  // null means "not checked yet for the current session" (still fetching);
  // 'none' means "checked, no surveyors row found" -- these used to share
  // the same null value, which is what caused the CompleteProfile flash.
  const [surveyorStatus, setSurveyorStatus] = useState<'pending' | 'active' | 'none' | null>(null);
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

    // Reset to "checking" for the new session rather than leaving whatever
    // status the previous session resolved to -- otherwise a stale 'active'
    // could briefly gate the loading check below on a session that hasn't
    // actually been checked yet.
    setSurveyorStatus(null);

    const fetchSurveyorStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('surveyors')
          .select('status')
          .eq('user_id', session.user.id)
          .single();

        if (error) {
          console.log('No surveyor profile found:', error.message);
          setSurveyorStatus('none');
          return;
        }

        setSurveyorStatus(data?.status as 'pending' | 'active');
      } catch (err) {
        console.error('Error fetching surveyor status:', err);
        setSurveyorStatus('none');
      }
    };

    fetchSurveyorStatus();
  }, [session]);

  // While a session exists but its surveyor status hasn't been fetched yet
  // (right after login, or on launch with a restored session), surveyorStatus
  // is still null -- the same value it holds when there's genuinely no
  // surveyor profile. Without this check that ambiguity fell through to the
  // CompleteProfile screen for a frame before the real status arrived and
  // flipped it to Main, which looked like a flash to the profile screen
  // before landing on Jobs. Keep showing the loading spinner instead until
  // the fetch actually resolves.
  if (loading || (session && surveyorStatus === null)) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#1a3c2e" />
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: GREEN },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        {!session
          ? <>
              <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
            </>
          : surveyorStatus === 'pending'
          ? <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} options={{ headerShown: false }} />
          : surveyorStatus === 'active'
          ? <>
              <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job Detail' }} />
              <Stack.Screen name="CoverageArea" component={CoverageAreaScreen} options={{ title: 'Coverage Area' }} />
              <Stack.Screen name="Insurance" component={InsuranceScreen} options={{ title: 'Insurance & Compliance' }} />
              <Stack.Screen name="Availability" component={AvailabilityScreen} options={{ title: 'Availability' }} />
            </>
          // surveyorStatus === 'none': session exists but no linked surveyors
          // row was found. This is never a case for RegisterScreen -- it
          // calls auth.signUp(), which always fails with Supabase's "email
          // already registered" response for a session that's already
          // authenticated, discarding whatever the user just typed. Collect
          // the profile directly against the existing session instead.
          : <Stack.Screen name="CompleteProfile" options={{ headerShown: false }}>
              {() => <CompleteProfileScreen session={session} onComplete={() => setSurveyorStatus('pending')} />}
            </Stack.Screen>
        }
      </Stack.Navigator>
    </NavigationContainer>
    </GestureHandlerRootView>
  );
}
