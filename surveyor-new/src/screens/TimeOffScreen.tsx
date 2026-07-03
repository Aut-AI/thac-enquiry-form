import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, TextInput
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

interface TimeOff {
  id: string;
  surveyor_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export default function TimeOffScreen() {
  const [timeOffList, setTimeOffList] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [surveyorId, setSurveyorId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useFocusEffect(useCallback(() => { loadTimeOff(); }, []));

  async function loadTimeOff() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: survData } = await supabase
      .from('surveyors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (survData?.id) {
      setSurveyorId(survData.id);

      const { data: timeOffData } = await supabase
        .from('surveyor_time_off')
        .select('*')
        .eq('surveyor_id', survData.id)
        .gte('start_date', new Date().toISOString().split('T')[0])
        .order('start_date', { ascending: true });

      setTimeOffList(timeOffData || []);
    }
    setLoading(false);
  }

  async function addTimeOff() {
    if (!surveyorId) return;
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please enter both dates');
      return;
    }
    if (startDate >= endDate) {
      Alert.alert('Invalid', 'Start date must be before end date');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('surveyor_time_off')
      .insert([{
        surveyor_id: surveyorId,
        start_date: startDate,
        end_date: endDate
      }]);

    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Time off added');
      setStartDate('');
      setEndDate('');
      loadTimeOff();
    }
  }

  async function deleteTimeOff(id: string) {
    Alert.alert('Delete', 'Remove this time off?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          const { error } = await supabase
            .from('surveyor_time_off')
            .delete()
            .eq('id', id);

          if (error) Alert.alert('Error', error.message);
          else loadTimeOff();
        }
      }
    ]);
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#1a3c2e" /></View>;
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Manage Your Time Off</Text>

      {/* Add Time Off Section */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Add Time Off</Text>

        <View style={s.dateGroup}>
          <Text style={s.label}>Start Date (YYYY-MM-DD)</Text>
          <TextInput
            style={s.dateInput}
            placeholder="2026-06-15"
            value={startDate}
            onChangeText={setStartDate}
            placeholderTextColor="#999"
          />
        </View>

        <View style={s.dateGroup}>
          <Text style={s.label}>End Date (YYYY-MM-DD)</Text>
          <TextInput
            style={s.dateInput}
            placeholder="2026-06-22"
            value={endDate}
            onChangeText={setEndDate}
            placeholderTextColor="#999"
          />
        </View>

        <TouchableOpacity
          style={[s.button, saving && s.buttonDisabled]}
          onPress={addTimeOff}
          disabled={saving}
        >
          <Text style={s.buttonText}>{saving ? 'Adding...' : 'Add Time Off'}</Text>
        </TouchableOpacity>
      </View>

      {/* Time Off List */}
      {timeOffList.length > 0 ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Your Time Off</Text>
          {timeOffList.map(item => (
            <View key={item.id} style={s.timeOffItem}>
              <View>
                <Text style={s.dateRange}>
                  {formatDate(item.start_date)} — {formatDate(item.end_date)}
                </Text>
                <Text style={s.days}>
                  {getDays(item.start_date, item.end_date)} days
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteTimeOff(item.id)}
                style={s.deleteBtn}
              >
                <Text style={s.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.noData}>No time off scheduled</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7f4' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a3c2e', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a3c2e', marginBottom: 16 },
  dateGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, textTransform: 'uppercase' },
  dateInput: { backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', padding: 12, fontSize: 15, color: '#1a1a1a' },
  button: { backgroundColor: '#1a3c2e', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  timeOffItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  dateRange: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  days: { fontSize: 13, color: '#666', marginTop: 4 },
  deleteBtn: { backgroundColor: '#fee2e2', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  deleteBtnText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  noData: { color: '#999', fontSize: 15, textAlign: 'center', paddingVertical: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
