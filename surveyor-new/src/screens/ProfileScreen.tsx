import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useSurveyorProfile } from '../lib/useSurveyorProfile';
import { RootStackParamList, Surveyor } from '../types';
import { sharedStyles as s, GREEN } from '../lib/profileStyles';

// Worst-case traffic light across the three compliance dates, so the menu
// row can flag "something needs attention" without opening the page.
function worstInsuranceLight(surveyor: Surveyor): string {
  const dates = [surveyor.pi_expiry_date, surveyor.pl_expiry_date, surveyor.dbs_expiry_date];
  const rank = (dateStr: string | null) => {
    if (!dateStr) return 1; // not set -- worth a look, but not urgent like an expiry
    const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    if (days < 0) return 3;
    if (days < 30) return 2;
    if (days < 90) return 1;
    return 0;
  };
  const worst = Math.max(...dates.map(rank));
  return ['🟢', '🟡', '🟠', '🔴'][worst];
}

interface MenuRowProps {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function MenuRow({ icon, title, subtitle, onPress }: MenuRowProps) {
  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress}>
      <Text style={rowStyles.icon}>{icon}</Text>
      <View style={rowStyles.textGroup}>
        <Text style={rowStyles.title}>{title}</Text>
        <Text style={rowStyles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={rowStyles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { surveyor, loading } = useSurveyorProfile();

  async function signOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a3c2e" /></View>;
  if (!surveyor) return (
    <View style={s.center}>
      <Text style={rowStyles.noProfile}>No surveyor profile found.</Text>
      <Text style={s.hint}>Contact Trevor to link your account.</Text>
      <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={rowStyles.name}>{surveyor.full_name}</Text>
        <Text style={rowStyles.email}>{surveyor.email}</Text>
        {surveyor.phone ? <Text style={rowStyles.detail}>{surveyor.phone}</Text> : null}
        {surveyor.home_postcode ? <Text style={rowStyles.detail}>📍 {surveyor.home_postcode} · {surveyor.radius_miles} mile radius</Text> : null}
        {surveyor.hourly_rate ? <Text style={rowStyles.detail}>£{surveyor.hourly_rate}/hr <Text style={{ fontSize: 12, color: '#999' }}>(set by admin)</Text></Text> : null}
      </View>

      <View style={[s.card, { padding: 0 }]}>
        <MenuRow
          icon="📍"
          title="Coverage Area"
          subtitle={surveyor.home_postcode ? `${surveyor.home_postcode} · ${surveyor.radius_miles} mile radius` : 'Set your postcode and travel radius'}
          onPress={() => nav.navigate('CoverageArea')}
        />
        <View style={rowStyles.rowDivider} />
        <MenuRow
          icon={worstInsuranceLight(surveyor)}
          title="Insurance & Compliance"
          subtitle="PI, PL, DBS expiry dates and certificates"
          onPress={() => nav.navigate('Insurance')}
        />
        <View style={rowStyles.rowDivider} />
        <MenuRow
          icon="📅"
          title="Availability Calendar"
          subtitle="Mark days you're available for work"
          onPress={() => nav.navigate('Availability')}
        />
      </View>

      <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const rowStyles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: '700', color: GREEN, marginBottom: 4 },
  email: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  detail: { fontSize: 14, color: '#374151', marginTop: 4 },
  noProfile: { fontSize: 18, fontWeight: '600', color: GREEN, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  rowDivider: { height: 1, backgroundColor: '#f0f0f0', marginLeft: 16 },
  icon: { fontSize: 22, width: 28, textAlign: 'center' },
  textGroup: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  chevron: { fontSize: 22, color: '#c0c0c0', fontWeight: '300' },
});
