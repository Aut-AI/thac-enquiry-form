import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useSurveyorProfile } from '../lib/useSurveyorProfile';
import { AvailabilityCalendar } from '../components/AvailabilityCalendar';
import { sharedStyles as s } from '../lib/profileStyles';

export default function AvailabilityScreen() {
  const { surveyor, loading: loadingProfile } = useSurveyorProfile();
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [savingAvail, setSavingAvail] = useState(false);

  const loadAvailability = useCallback(async () => {
    if (!surveyor?.id) return;
    setLoadingAvail(true);
    const { data } = await supabase
      .from('surveyor_availability')
      .select('date, is_available')
      .eq('surveyor_id', surveyor.id)
      .gte('date', new Date().toISOString().split('T')[0]);

    const availMap: Record<string, boolean> = {};
    data?.forEach(a => { availMap[a.date] = a.is_available; });
    setAvailability(availMap);
    setLoadingAvail(false);
  }, [surveyor?.id]);

  useFocusEffect(useCallback(() => { loadAvailability(); }, [loadAvailability]));

  // Called once per drag gesture (a plain tap is a one-day drag) with every
  // date touched during it, so a whole range saves as a single request the
  // moment the finger lifts -- nothing is left unsaved to lose by
  // navigating away.
  async function commitAvailabilityDays(dates: string[], isAvailable: boolean) {
    if (!surveyor || dates.length === 0) return;
    setSavingAvail(true);

    const previous = availability;
    setAvailability(prev => {
      const next = { ...prev };
      for (const date of dates) next[date] = isAvailable;
      return next;
    });

    try {
      const { error } = await supabase.from('surveyor_availability').upsert(
        dates.map(date => ({ surveyor_id: surveyor.id, date, is_available: isAvailable })),
        { onConflict: 'surveyor_id,date' }
      );

      if (error) throw error;
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setAvailability(previous);
    } finally {
      setSavingAvail(false);
    }
  }

  if (loadingProfile || loadingAvail) {
    return <View style={s.center}><ActivityIndicator size="large" color="#1a3c2e" /></View>;
  }
  if (!surveyor) {
    return <View style={s.center}><Text style={s.hint}>No surveyor profile found.</Text></View>;
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.sectionTitle}>Availability Calendar</Text>
        <Text style={s.hint}>🟢 Available · ⬜ Unavailable · Drag across days to set a range at once</Text>
        <AvailabilityCalendar
          availability={availability}
          onCommitDays={commitAvailabilityDays}
          disabled={savingAvail}
        />
      </View>
    </ScrollView>
  );
}
