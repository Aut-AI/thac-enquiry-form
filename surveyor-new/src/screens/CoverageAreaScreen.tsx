import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useSurveyorProfile } from '../lib/useSurveyorProfile';
import { sharedStyles as s, GREEN } from '../lib/profileStyles';

interface ComputedOutcode {
  outcode: string;
  distance_miles: number;
}

export default function CoverageAreaScreen() {
  const { surveyor, loading, reload } = useSurveyorProfile();
  const [editPostcode, setEditPostcode] = useState('');
  const [editRadius, setEditRadius] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [showOutcodes, setShowOutcodes] = useState(false);
  const [serviceOutcodes, setServiceOutcodes] = useState<ComputedOutcode[]>([]);

  useEffect(() => {
    if (surveyor) {
      setEditPostcode(surveyor.home_postcode || '');
      setEditRadius(String(surveyor.radius_miles || 25));
    }
  }, [surveyor]);

  const loadOutcodes = useCallback(async () => {
    if (!surveyor?.id) return;
    const { data } = await supabase
      .from('surveyor_service_outcodes')
      .select('outcode, distance_miles')
      .eq('surveyor_id', surveyor.id)
      .order('distance_miles', { ascending: true });
    setServiceOutcodes(data || []);
  }, [surveyor?.id]);

  useFocusEffect(useCallback(() => { loadOutcodes(); }, [loadOutcodes]));

  async function saveLocation() {
    if (!surveyor) return;
    setSavingLocation(true);

    try {
      const radius = parseInt(editRadius) || 25;
      const { error } = await supabase
        .from('surveyors')
        .update({ home_postcode: editPostcode, radius_miles: radius })
        .eq('id', surveyor.id);

      if (error) throw error;
      Alert.alert('Saved', 'Your location and coverage radius have been updated.');
      await reload();
      await loadOutcodes();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingLocation(false);
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a3c2e" /></View>;
  if (!surveyor) return <View style={s.center}><Text style={s.hint}>No surveyor profile found.</Text></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.sectionTitle}>Your Coverage Area</Text>
        <Text style={s.hint}>Set your home postcode and travel radius. We automatically calculate which postcode areas (outcodes) you can serve.</Text>

        <View style={styles.formGroup}>
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

        <View style={styles.formGroup}>
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
          <Text style={s.helperText}>Larger radius = more nearby jobs to group together. You're never obligated to accept any work.</Text>
        </View>

        <TouchableOpacity
          style={[s.saveBtn, savingLocation && s.saveBtnDisabled]}
          onPress={saveLocation}
          disabled={savingLocation}
        >
          <Text style={s.saveBtnText}>{savingLocation ? 'Saving...' : 'Save Location'}</Text>
        </TouchableOpacity>

        <View style={s.divider} />

        <TouchableOpacity style={styles.outcodeHeader} onPress={() => setShowOutcodes(!showOutcodes)}>
          <View style={styles.outcodeHeaderLeft}>
            <Text style={styles.outcodeHeaderLabel}>Automatically Matched Outcodes</Text>
            {serviceOutcodes.length > 0 && (
              <Text style={styles.outcodeHeaderCount}>{serviceOutcodes.length} matches</Text>
            )}
          </View>
          <Text style={styles.outcodeToggle}>{showOutcodes ? '▼' : '▶'}</Text>
        </TouchableOpacity>

        {showOutcodes && (
          <View>
            <Text style={s.hint}>Based on your postcode and travel radius</Text>
            {serviceOutcodes.length > 0 ? (
              <View style={styles.outcodeList}>
                {serviceOutcodes.map(item => (
                  <View key={item.outcode} style={styles.outcodeTag}>
                    <Text style={styles.outcodeText}>{item.outcode}</Text>
                    <Text style={styles.outcodeDistance}>{item.distance_miles}mi</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noOutcodes}>
                {surveyor?.home_lat ? 'No matching outcodes within your radius.' : 'Set your postcode above to see matched outcodes.'}
              </Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  formGroup: { marginBottom: 12 },
  outcodeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  outcodeHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  outcodeHeaderLabel: { fontSize: 12, fontWeight: '600', color: GREEN },
  outcodeHeaderCount: { fontSize: 12, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  outcodeToggle: { fontSize: 12, color: '#6b7280' },
  outcodeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  outcodeTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dbeafe', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  outcodeText: { fontSize: 13, fontWeight: '600', color: GREEN },
  outcodeDistance: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  noOutcodes: { fontSize: 13, color: '#9ca3af', marginTop: 12, fontStyle: 'italic' },
});
