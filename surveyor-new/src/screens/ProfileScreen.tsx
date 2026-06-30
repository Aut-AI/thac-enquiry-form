import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Surveyor } from '../types';

interface ComputedOutcode {
  outcode: string;
  distance_miles: number;
}

function trafficLight(dateStr: string | null): string {
  if (!dateStr) return '⚪';
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0)  return '🔴';
  if (days < 30) return '🟠';
  if (days < 90) return '🟡';
  return '🟢';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not set';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProfileScreen() {
  const [surveyor, setSurveyor] = useState<Surveyor | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [savingAvail, setSavingAvail] = useState(false);
  const [serviceOutcodes, setServiceOutcodes] = useState<ComputedOutcode[]>([]);
  const [editPostcode, setEditPostcode] = useState('');
  const [editRadius, setEditRadius] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [showOutcodes, setShowOutcodes] = useState(false);

  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  async function loadProfile() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: surveyorData } = await supabase
      .from('surveyors')
      .select('*')
      .eq('user_id', user.id)
      .single();

    setSurveyor(surveyorData);
    if (surveyorData) {
      setEditPostcode(surveyorData.home_postcode || '');
      setEditRadius(String(surveyorData.radius_miles || 25));
    }

    if (surveyorData?.id) {
      const { data: availData } = await supabase
        .from('surveyor_availability')
        .select('date, is_available')
        .eq('surveyor_id', surveyorData.id)
        .gte('date', new Date().toISOString().split('T')[0]);

      const availMap: Record<string, boolean> = {};
      availData?.forEach(a => { availMap[a.date] = a.is_available; });
      setAvailability(availMap);

      const { data: serviceData } = await supabase
        .from('surveyor_service_outcodes')
        .select('outcode, distance_miles')
        .eq('surveyor_id', surveyorData.id)
        .order('distance_miles', { ascending: true });

      setServiceOutcodes(serviceData || []);
    }

    setLoading(false);
  }

  async function toggleAvailability(date: string) {
    if (!surveyor) return;
    setSavingAvail(true);

    const newAvail = !availability[date];
    setAvailability(prev => ({ ...prev, [date]: newAvail }));

    try {
      const { error } = await supabase.from('surveyor_availability').upsert({
        surveyor_id: surveyor.id,
        date,
        is_available: newAvail,
      }, { onConflict: 'surveyor_id,date' });

      if (error) throw error;
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setAvailability(prev => ({ ...prev, [date]: !newAvail }));
    } finally {
      setSavingAvail(false);
    }
  }

  async function saveLocation() {
    if (!surveyor) return;
    setSavingLocation(true);

    try {
      const radius = parseInt(editRadius) || 25;
      const { error } = await supabase
        .from('surveyors')
        .update({
          home_postcode: editPostcode,
          radius_miles: radius,
        })
        .eq('id', surveyor.id);

      if (error) throw error;
      Alert.alert('Saved', 'Your location and coverage radius have been updated.');
      await loadProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingLocation(false);
    }
  }

  async function signOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a3c2e" /></View>;
  if (!surveyor) return (
    <View style={s.center}>
      <Text style={s.noProfile}>No surveyor profile found.</Text>
      <Text style={s.hint}>Contact Trevor to link your account.</Text>
      <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, gap: 12 }}>

      <View style={s.card}>
        <Text style={s.name}>{surveyor.full_name}</Text>
        <Text style={s.email}>{surveyor.email}</Text>
        {surveyor.phone ? <Text style={s.detail}>{surveyor.phone}</Text> : null}
        {surveyor.home_postcode ? <Text style={s.detail}>📍 {surveyor.home_postcode} · {surveyor.radius_miles} mile radius</Text> : null}
        {surveyor.hourly_rate ? <Text style={s.detail}>£{surveyor.hourly_rate}/hr <Text style={{fontSize: 12, color: '#999'}}>(set by admin)</Text></Text> : null}
      </View>

      {/* Service Area Settings */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Your Coverage Area</Text>
        <Text style={s.hint}>Set your home postcode and travel radius. We automatically calculate which postcode areas (outcodes) you can serve.</Text>

        <View style={s.locationFormGroup}>
          <Text style={s.label}>Home Postcode</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. SW19 2AB"
            value={editPostcode}
            onChangeText={setEditPostcode}
            editable={!savingLocation}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={s.locationFormGroup}>
          <Text style={s.label}>Travel Radius (miles)</Text>
          <TextInput
            style={s.input}
            placeholder="25"
            value={editRadius}
            onChangeText={setEditRadius}
            keyboardType="number-pad"
            editable={!savingLocation}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <TouchableOpacity
          style={[s.saveBtn, savingLocation && s.saveBtnDisabled]}
          onPress={saveLocation}
          disabled={savingLocation}
        >
          <Text style={s.saveBtnText}>{savingLocation ? 'Saving...' : 'Save Location'}</Text>
        </TouchableOpacity>

        <View style={s.divider} />

        <TouchableOpacity style={s.outcodeHeader} onPress={() => setShowOutcodes(!showOutcodes)}>
          <View style={s.outcodeHeaderLeft}>
            <Text style={s.outcodeHeaderLabel}>Automatically Matched Outcodes</Text>
            {serviceOutcodes.length > 0 && (
              <Text style={s.outcodeHeaderCount}>{serviceOutcodes.length} matches</Text>
            )}
          </View>
          <Text style={s.outcodeToggle}>{showOutcodes ? '▼' : '▶'}</Text>
        </TouchableOpacity>

        {showOutcodes && (
          <View>
            <Text style={s.hint}>Based on your postcode and travel radius</Text>
            {serviceOutcodes.length > 0 ? (
              <View style={s.outcodeList}>
                {serviceOutcodes.map(item => (
                  <View key={item.outcode} style={s.outcodeTag}>
                    <Text style={s.outcodeText}>{item.outcode}</Text>
                    <Text style={s.outcodeDistance}>{item.distance_miles}mi</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={s.noOutcodes}>
                {surveyor?.home_lat ? 'No matching outcodes within your radius.' : 'Set your postcode above to see matched outcodes.'}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>Insurance & Compliance</Text>
        <View style={s.insuranceRow}>
          <View style={s.insuranceItem}>
            <Text style={s.insuranceLight}>{trafficLight(surveyor.pi_expiry)}</Text>
            <Text style={s.insuranceLabel}>PI Insurance</Text>
            <Text style={s.insuranceDate}>{formatDate(surveyor.pi_expiry)}</Text>
          </View>
          <View style={s.insuranceItem}>
            <Text style={s.insuranceLight}>{trafficLight(surveyor.pl_expiry)}</Text>
            <Text style={s.insuranceLabel}>PL Insurance</Text>
            <Text style={s.insuranceDate}>{formatDate(surveyor.pl_expiry)}</Text>
          </View>
          <View style={s.insuranceItem}>
            <Text style={s.insuranceLight}>{trafficLight(surveyor.dbs_expiry)}</Text>
            <Text style={s.insuranceLabel}>DBS Check</Text>
            <Text style={s.insuranceDate}>{formatDate(surveyor.dbs_expiry)}</Text>
          </View>
        </View>
      </View>

      {/* Availability Calendar */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Availability Calendar</Text>
        <Text style={s.calendarHint}>🟢 Available · 🔘 Unavailable</Text>
        {renderCalendar()}
      </View>

      <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>

    </ScrollView>
  );

  function renderCalendar() {
    const months: React.ReactNode[] = [];
    const today = new Date();

    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + m, 1);
      const monthName = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
      const firstDay = monthDate.getDay();

      const days: React.ReactNode[] = [];
      for (let i = 0; i < firstDay; i++) days.push(<View key={`empty-${i}`} style={s.dayEmpty} />);

      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        const dateStr = d.toISOString().split('T')[0];
        const isAvail = availability[dateStr] !== false;

        days.push(
          <TouchableOpacity
            key={dateStr}
            style={[s.dayBtn, isAvail ? s.dayAvailable : s.dayUnavailable]}
            onPress={() => toggleAvailability(dateStr)}
            disabled={savingAvail}
          >
            <Text style={s.dayText}>{day}</Text>
          </TouchableOpacity>
        );
      }

      months.push(
        <View key={`month-${m}`} style={s.monthContainer}>
          <Text style={s.monthName}>{monthName}</Text>
          <View style={s.monthGrid}>{days}</View>
        </View>
      );
    }

    return <View>{months}</View>;
  }
}

const GREEN = '#1a3c2e';

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#f5f5f5' },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:          { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2 },
  name:          { fontSize: 22, fontWeight: '700', color: GREEN, marginBottom: 4 },
  email:         { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  detail:        { fontSize: 14, color: '#374151', marginTop: 4 },
  sectionTitle:  { fontSize: 12, fontWeight: '700', color: GREEN, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
  insuranceRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  insuranceItem: { alignItems: 'center', gap: 4 },
  insuranceLight:{ fontSize: 28 },
  insuranceLabel:{ fontSize: 12, color: '#6b7280', fontWeight: '600', textAlign: 'center' },
  insuranceDate: { fontSize: 11, color: '#9ca3af', textAlign: 'center' },
  noProfile:     { fontSize: 18, fontWeight: '600', color: GREEN, marginBottom: 8 },
  hint:          { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  label:         { fontSize: 12, fontWeight: '600', color: GREEN, marginBottom: 6 },
  input:         { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#374151', marginBottom: 12 },
  signOutBtn:    { backgroundColor: '#fee2e2', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  signOutText:   { color: '#dc2626', fontWeight: '700', fontSize: 15 },
  calendarHint:  { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  monthContainer:{ marginBottom: 20 },
  monthName:     { fontSize: 14, fontWeight: '700', color: GREEN, marginBottom: 8 },
  monthGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dayBtn:        { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  dayAvailable:  { backgroundColor: '#bbf7d0' },
  dayUnavailable:{ backgroundColor: '#f3f4f6' },
  dayEmpty:      { width: '14.28%', aspectRatio: 1 },
  dayText:       { fontSize: 12, fontWeight: '600', color: '#1a1a1a' },
  locationFormGroup:{ marginBottom: 12 },
  outcodeHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  outcodeHeaderLeft:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  outcodeHeaderLabel:{ fontSize: 12, fontWeight: '600', color: GREEN },
  outcodeHeaderCount:{ fontSize: 12, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  outcodeToggle:    { fontSize: 12, color: '#6b7280' },
  outcodeList:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  outcodeTag:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dbeafe', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  outcodeText:   { fontSize: 13, fontWeight: '600', color: GREEN },
  outcodeDistance:{ fontSize: 11, color: '#6b7280', fontWeight: '500' },
  noOutcodes:    { fontSize: 13, color: '#9ca3af', marginTop: 12, fontStyle: 'italic' },
  saveBtn:       { backgroundColor: GREEN, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled:{ opacity: 0.6 },
  saveBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  divider:       { height: 1, backgroundColor: '#e5e7eb', marginVertical: 16 },
});
