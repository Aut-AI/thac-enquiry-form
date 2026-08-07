import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { fetchServiceOutcodes, extractOutcode } from '../lib/outcode';
import { Job, RootStackParamList } from '../types';

const URGENCY_COLORS: Record<string, string> = {
  red: '#dc2626', orange: '#ea580c', yellow: '#ca8a04', grey: '#9ca3af', green: '#16a34a',
};

const SURVEY_LABELS: Record<string, string> = {
  bs5837: 'BS5837', vta: 'VTA', bc: 'BS5837 Stage 2', subs: 'Subsidence',
  mortgage: 'Mortgage', amendment: 'Amendment', other: 'Other',
};

const URGENCY_LABELS: Record<string, string> = {
  red: 'Urgent', orange: 'Elevated', yellow: 'Standard', grey: 'Low', green: 'On Track',
};

// Distinct from the urgency palette above so a surveyor's own committed
// jobs read as clearly different from available (red) ones at a glance --
// urgency doesn't matter once a job's already claimed, so these don't
// share that colour vocabulary.
const MINE_COLOR = '#2563eb';
const MINE_STATE_LABELS: Record<string, string> = { orange: 'Claimed', yellow: 'Attended' };

export default function JobMapScreen() {
  const [jobs,    setJobs]    = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Job | null>(null);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useFocusEffect(useCallback(() => { loadJobs(); }, []));

  async function loadJobs() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Get surveyor ID and their service coverage
    const { data: surveyorData } = await supabase
      .from('surveyors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const surveyorId = surveyorData?.id;
    const serviceOutcodes = surveyorId ? await fetchServiceOutcodes(surveyorId) : new Set<string>();

    const JOB_FIELDS = 'id,reference,survey_type,site_postcode,site_lat,site_lng,urgency_state,dispatch_state,sla_deadline,surveyor_pay_amount,enquiry_id,enquiries(tree_count_band)';

    // Available jobs (unclaimed, within this surveyor's coverage area) and
    // this surveyor's own already-committed jobs (claimed/attended, no
    // coverage filter needed -- they're already assigned regardless of
    // current coverage) load together, so a surveyor can see how new
    // available work sits relative to jobs they're already committed to.
    const availableQuery = supabase
      .from('jobs')
      .select(JOB_FIELDS)
      .eq('dispatch_state', 'red')
      .not('site_lat', 'is', null)
      .not('site_lng', 'is', null);

    const mineQuery = surveyorId
      ? supabase
          .from('jobs')
          .select(JOB_FIELDS)
          .eq('surveyor_id', surveyorId)
          .in('dispatch_state', ['orange', 'yellow'])
          .not('site_lat', 'is', null)
          .not('site_lng', 'is', null)
      : null;

    const [availableResult, mineResult] = await Promise.all([
      availableQuery,
      mineQuery ?? Promise.resolve({ data: [], error: null }),
    ]);

    if (availableResult.error) Alert.alert('Error', availableResult.error.message);
    else if (mineResult.error) Alert.alert('Error', mineResult.error.message);
    else {
      // Filter available jobs: only show those within surveyor's service area
      const filteredAvailable = (availableResult.data || []).filter(job => {
        const jobOutcode = extractOutcode(job.site_postcode);
        return serviceOutcodes.has(jobOutcode);
      });

      const combined = [...filteredAvailable, ...(mineResult.data || [])];
      const jobsWithTreeCount = combined.map((job: any) => ({
        ...job,
        tree_count_band: job.enquiries?.tree_count_band || null,
      }));
      setJobs(jobsWithTreeCount);
    }
    setLoading(false);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#1a3c2e" /></View>;
  }

  const availableCount = jobs.filter(j => j.dispatch_state === 'red').length;
  const mineCount = jobs.length - availableCount;

  return (
    <View style={s.container}>
      <MapView
        style={s.map}
        initialRegion={{ latitude: 51.5, longitude: -1.5, latitudeDelta: 3, longitudeDelta: 3 }}
        showsUserLocation
      >
        {jobs.map(job => (
          <Marker
            key={job.id}
            coordinate={{ latitude: job.site_lat!, longitude: job.site_lng! }}
            pinColor={job.dispatch_state === 'red' ? (URGENCY_COLORS[job.urgency_state] || '#9ca3af') : MINE_COLOR}
            onPress={() => setPreview(job)}
          />
        ))}
      </MapView>

      <View style={s.badgeStack}>
        <View style={s.badge}>
          <Text style={s.badgeText}>{availableCount} available job{availableCount !== 1 ? 's' : ''}</Text>
        </View>
        {mineCount > 0 && (
          <View style={[s.badge, s.badgeMine]}>
            <Text style={s.badgeText}>{mineCount} of yours</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={s.refresh} onPress={loadJobs}>
        <Text style={s.refreshText}>↻</Text>
      </TouchableOpacity>

      <Modal transparent visible={!!preview} animationType="fade" onRequestClose={() => setPreview(null)}>
        <TouchableOpacity style={s.modalOverlay} onPress={() => setPreview(null)} activeOpacity={1}>
          <View
            style={[
              s.previewCard,
              preview && {
                borderLeftWidth: 6,
                borderLeftColor: preview.dispatch_state === 'red'
                  ? (URGENCY_COLORS[preview.urgency_state] || '#9ca3af')
                  : MINE_COLOR,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {preview && (
              <>
                <View style={s.previewHeaderRow}>
                  <Text style={s.previewRef}>{preview.reference || 'No reference'}</Text>
                  {preview.dispatch_state === 'red' ? (
                    <View style={[s.statusBadge, { backgroundColor: URGENCY_COLORS[preview.urgency_state] || '#9ca3af' }]}>
                      <Text style={s.statusBadgeText}>{URGENCY_LABELS[preview.urgency_state] || preview.urgency_state}</Text>
                    </View>
                  ) : (
                    <View style={[s.statusBadge, { backgroundColor: MINE_COLOR }]}>
                      <Text style={s.statusBadgeText}>{MINE_STATE_LABELS[preview.dispatch_state] || 'Yours'}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.previewType}>{SURVEY_LABELS[preview.survey_type] || preview.survey_type}</Text>
                <View style={s.previewDivider} />
                <Text style={s.previewLabel}>Postcode</Text>
                <Text style={s.previewValue}>{preview.site_postcode || '—'}</Text>
                <Text style={s.previewLabel}>Tree Count</Text>
                <Text style={s.previewValue}>{preview.tree_count_band || '—'}</Text>
                <Text style={s.previewLabel}>SLA Deadline</Text>
                <Text style={s.previewValue}>{preview.sla_deadline ? new Date(preview.sla_deadline).toLocaleDateString() : '—'}</Text>
                {preview.surveyor_pay_amount ? (
                  <>
                    <Text style={s.previewLabel}>Surveyor Pay</Text>
                    <Text style={s.previewPay}>£{preview.surveyor_pay_amount.toFixed(0)}</Text>
                  </>
                ) : null}
                <TouchableOpacity style={s.previewButton} onPress={() => {
                  setPreview(null);
                  nav.navigate('JobDetail', { jobId: preview.id });
                }}>
                  <Text style={s.previewButtonText}>View Full Details →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  callout:   { width: 240, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  calloutRef:      { fontWeight: '700', fontSize: 15, color: '#1a3c2e' },
  calloutType:     { fontSize: 13, color: '#374151', marginTop: 4 },
  calloutPostcode: { fontSize: 13, color: '#6b7280' },
  calloutPay:      { fontSize: 13, fontWeight: '600', color: '#16a34a', marginTop: 6 },
  calloutTap:      { fontSize: 12, color: '#9ca3af', marginTop: 8, fontWeight: '500' },
  badgeStack: {
    position: 'absolute', top: 16, left: 16, gap: 8,
  },
  badge: {
    backgroundColor: '#1a3c2e', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  badgeMine: {
    backgroundColor: MINE_COLOR,
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  refresh: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: '#1a3c2e', width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', elevation: 4,
  },
  refreshText: { color: '#fff', fontSize: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  previewCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '85%', maxWidth: 320, elevation: 8 },
  previewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  previewRef: { fontSize: 18, fontWeight: '700', color: '#1a3c2e' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  previewType: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  previewDivider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  previewLabel: { fontSize: 11, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginTop: 8 },
  previewValue: { fontSize: 14, color: '#374151', marginTop: 2 },
  previewPay: { fontSize: 16, fontWeight: '700', color: '#16a34a', marginTop: 2 },
  previewButton: { marginTop: 16, backgroundColor: '#1a3c2e', borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
  previewButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
