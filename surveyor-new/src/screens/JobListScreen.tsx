import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { fetchServiceOutcodes, extractOutcode } from '../lib/outcode';
import { Job, RootStackParamList } from '../types';

const URGENCY_COLORS: Record<string, string> = {
  red: '#dc2626', orange: '#ea580c', yellow: '#ca8a04', grey: '#9ca3af',
};

const SURVEY_LABELS: Record<string, string> = {
  bs5837: 'BS5837 Tree Survey', vta: 'VTA', bc: 'BS5837 Stage 2',
  subs: 'Subsidence', mortgage: 'Mortgage', amendment: 'Amendment', other: 'Other',
};

type Filter = 'available' | 'mine';

export default function JobListScreen() {
  const [jobs,      setJobs]      = useState<Job[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<Filter>('available');
  const [surveyorId, setSurveyorId] = useState<string | null>(null);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useFocusEffect(useCallback(() => {
    loadSurveyorAndJobs();
  }, [filter]));

  async function loadSurveyorAndJobs() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: surveyorData } = await supabase
      .from('surveyors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const sid = surveyorData?.id || null;
    setSurveyorId(sid);

    let query = supabase
      .from('jobs')
      .select('id,reference,survey_type,site_postcode,urgency_state,dispatch_state,sla_deadline,surveyor_pay_amount,claimed_at')
      .order('sla_deadline', { ascending: true });

    if (filter === 'available') {
      query = query.eq('dispatch_state', 'red');
    } else if (sid) {
      query = query.eq('surveyor_id', sid).in('dispatch_state', ['orange', 'yellow']);
    }

    const { data, error } = await query;
    if (error) {
      Alert.alert('Error', error.message);
      setJobs([]);
    } else {
      let filtered = data || [];

      // For available tab, filter by surveyor's coverage area
      if (filter === 'available' && sid) {
        const serviceOutcodes = await fetchServiceOutcodes(sid);
        filtered = filtered.filter(job => {
          const jobOutcode = extractOutcode(job.site_postcode);
          return serviceOutcodes.has(jobOutcode);
        });
      }

      setJobs(filtered);
    }
    setLoading(false);
  }

  function renderJob({ item: job }: { item: Job }) {
    const urgencyColor = URGENCY_COLORS[job.urgency_state] || '#9ca3af';
    const daysLeft = job.sla_deadline
      ? Math.ceil((new Date(job.sla_deadline).getTime() - Date.now()) / 86400000)
      : null;

    return (
      <TouchableOpacity style={s.card} onPress={() => nav.navigate('JobDetail', { jobId: job.id })}>
        <View style={[s.urgencyBar, { backgroundColor: urgencyColor }]} />
        <View style={s.cardBody}>
          <View style={s.cardHeader}>
            <Text style={s.ref}>{job.reference || 'No ref'}</Text>
            {job.surveyor_pay_amount
              ? <Text style={s.pay}>£{job.surveyor_pay_amount.toFixed(0)}</Text>
              : null}
          </View>
          <Text style={s.type}>{SURVEY_LABELS[job.survey_type] || job.survey_type}</Text>
          <Text style={s.postcode}>{job.site_postcode || '—'}</Text>
          {daysLeft !== null && (
            <Text style={[s.sla, { color: daysLeft < 2 ? '#dc2626' : daysLeft < 4 ? '#ea580c' : '#6b7280' }]}>
              {daysLeft <= 0 ? '⚠️ Overdue' : `${daysLeft}d remaining`}
            </Text>
          )}
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.tabs}>
        {(['available', 'mine'] as Filter[]).map(f => (
          <TouchableOpacity key={f} style={[s.tab, filter === f && s.tabActive]} onPress={() => setFilter(f)}>
            <Text style={[s.tabText, filter === f && s.tabTextActive]}>
              {f === 'available' ? '🔴 Available' : '🟠 My Jobs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <View style={s.center}><ActivityIndicator size="large" color="#1a3c2e" /></View>
        : <FlatList
            data={jobs}
            keyExtractor={j => j.id}
            renderItem={renderJob}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={loadSurveyorAndJobs} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyIcon}>{filter === 'available' ? '🎉' : '📋'}</Text>
                <Text style={s.emptyText}>
                  {filter === 'available' ? 'No available jobs right now' : 'No active jobs assigned to you'}
                </Text>
              </View>
            }
          />}
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f5f5' },
  tabs:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab:          { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: '#1a3c2e' },
  tabText:      { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  tabTextActive:{ color: '#1a3c2e', fontWeight: '700' },
  card:         { backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', elevation: 2 },
  urgencyBar:   { width: 4, alignSelf: 'stretch' },
  cardBody:     { flex: 1, padding: 14 },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  ref:          { fontSize: 15, fontWeight: '700', color: '#1a3c2e' },
  pay:          { fontSize: 14, fontWeight: '700', color: '#16a34a' },
  type:         { fontSize: 13, color: '#374151', marginBottom: 2 },
  postcode:     { fontSize: 12, color: '#6b7280' },
  sla:          { fontSize: 12, fontWeight: '600', marginTop: 4 },
  arrow:        { fontSize: 24, color: '#d1d5db', paddingHorizontal: 14 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:        { alignItems: 'center', paddingTop: 60 },
  emptyIcon:    { fontSize: 40, marginBottom: 12 },
  emptyText:    { fontSize: 15, color: '#6b7280', textAlign: 'center' },
});
