// Push notifications (Expo). Registers this phone's push token against the
// signed-in surveyor so the notify-surveyors Edge Function can alert them about
// new jobs and allocations. Everything here is best-effort: a failure (no
// permission, simulator, offline) must never break the app.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }) as any,
});

export async function registerForPush(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Jobs',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    await supabase.from('surveyors').update({ expo_push_token: token }).eq('user_id', userId);
  } catch (e) {
    console.log('Push registration skipped:', e);
  }
}

// Call before signing out so the next person on this phone doesn't inherit alerts.
export async function unregisterPush(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('surveyors').update({ expo_push_token: null }).eq('user_id', user.id);
  } catch {}
}
