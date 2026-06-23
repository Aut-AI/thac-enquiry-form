import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Linking, TextInput, Clipboard, Dimensions, Platform,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Job, RootStackParamList } from '../types';
import NDAModal from './NDAModal';

type RouteProps = RouteProp<RootStackParamList, 'JobDetail'>;

const SURVEY_LABELS: Record<string, string> = {
  bs5837: 'BS5837 Tree Survey (Planning)', vta: 'Visual Tree Assessment',
  bc: 'BS5837 Stage 2 (AIA/AMS/TPP)', subs: 'Subsidence / Building Damage',
  mortgage: 'Mortgage / Insurer Report', amendment: 'Amendment', other: 'Other',
};

function ParkingLocationMap({ parkingLat, parkingLng }: { parkingLat: number; parkingLng: number }) {
  if (!parkingLat || !parkingLng) return null;

  return (
    <View style={{ height: 320, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ddd' }}>
      <Text style={{ color: '#666', fontSize: 14, fontWeight: '600' }}>Parking Location Map</Text>
      <Text style={{ color: '#999', fontSize: 12, marginTop: 4 }}>(Available on mobile app)</Text>
    </View>
  );

  const MapView = require('react-native-maps').default;
  const Polygon = require('react-native-maps').Polygon;
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain'>('standard');

  try {
    const parsed = JSON.parse(polygon);
    let coordinates = [];

    if (Array.isArray(parsed)) {
      coordinates = parsed;
    } else if (parsed?.coordinates?.[0]) {
      coordinates = parsed.coordinates[0];
    } else if (parsed?.coordinates) {
      coordinates = parsed.coordinates;
    }

    const validCoords = coordinates.filter((c: any) =>
      Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number'
    );

    if (validCoords.length < 3) return null;

    const mapCoords = validCoords.map((c: any) => ({
      latitude: c[0],
      longitude: c[1],
    }));

    return (
      <View>
        <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 8, paddingHorizontal: 4 }}>
          {['standard', 'satellite', 'terrain'].map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setMapType(type as any)}
              style={{
                flex: 1,
                paddingVertical: 6,
                paddingHorizontal: 8,
                borderRadius: 4,
                backgroundColor: mapType === type ? '#1a3c2e' : '#e5e7eb',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: mapType === type ? '#fff' : '#374151', textTransform: 'capitalize' }}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <MapView
          style={{ height: 320, borderRadius: 8, overflow: 'hidden' }}
          initialRegion={{
            latitude: jobLat,
            longitude: jobLng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          mapType={mapType}
          zoomEnabled={true}
          scrollEnabled={true}
          showsUserLocation={true}
        >
          <Polygon
            coordinates={mapCoords}
            strokeColor="#1a3c2e"
            strokeWidth={2}
            fillColor="rgba(26, 60, 46, 0.15)"
          />
        </MapView>
      </View>
    );
  } catch (e) {
    return null;
  }
}

export default function JobDetailScreen() {
  const { params: { jobId } } = useRoute<RouteProps>();
  const nav = useNavigation();
  const [job,        setJob]        = useState<Job | null>(null);
  const [enquiry,    setEnquiry]    = useState<any>(null);
  const [surveyorId, setSurveyorId] = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [notes,      setNotes]      = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [files,      setFiles]      = useState<any[]>([]);
  const [uploading,  setUploading]  = useState(false);
  const [surveyor,   setSurveyor]   = useState<any>(null);
  const [surveyHours, setSurveyHours] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [showNDA, setShowNDA] = useState(false);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!job?.allocated_surveyor_id || job?.allocation_rejected_at) return;

    const updateCountdown = () => {
      const allocatedAt = new Date(job.allocated_at).getTime();
      const timeoutMs = (job.allocation_timeout_hours || 48) * 60 * 60 * 1000;
      const expiresAt = allocatedAt + timeoutMs;
      const now = new Date().getTime();
      const remaining = expiresAt - now;

      if (remaining <= 0) {
        setTimeRemaining('Expired');
      } else {
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        setTimeRemaining(`${hours}h ${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [job]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const [{ data: jobData }, { data: survData }, { data: filesData }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).single(),
      supabase.from('surveyors').select('*').eq('user_id', user?.id || '').single(),
      supabase.from('job_files').select('*').eq('job_id', jobId).order('uploaded_at', { ascending: false }),
    ]);

    // Load enquiry acceptance details if job has enquiry_id
    if (jobData?.enquiry_id) {
      const { data: enqData } = await supabase
        .from('enquiries')
        .select('contact_name,contact_phone,access_details,parking_details,report_title,parking_lat,parking_lng,tree_count_band')
        .eq('id', jobData.enquiry_id)
        .single();
      setEnquiry(enqData);
    }

    if (jobData?.survey_type) {
      const { data: surveyTypeData } = await supabase
        .from('survey_types')
        .select('hours_on_site')
        .eq('survey_type', jobData.survey_type)
        .single();
      setSurveyHours(surveyTypeData?.hours_on_site || 1);
    }

    setJob(jobData);
    setSurveyorId(survData?.id || null);
    setSurveyor(survData);
    setNotes(jobData?.surveyor_notes || '');
    setFiles(filesData || []);
    setLoading(false);
  }

  async function uploadFile() {
    Alert.alert('File Upload', 'Document picker will be enabled in the next release');
  }

  async function deleteFile(filePath: string) {
    Alert.alert('Delete', 'Remove this file?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', onPress: async () => {
        try {
          await supabase.storage.from('THAC-CRM_Bucket').remove([filePath]);
          await supabase.from('job_files').delete().eq('file_path', filePath);
          loadData();
        } catch (e: any) {
          Alert.alert('Error', e.message);
        }
      }, style: 'destructive' },
    ]);
  }

  function claimJob() {
    if (!surveyorId) { Alert.alert('Error', 'Surveyor profile not found.'); return; }
    setShowNDA(true);
  }

  async function acceptNDAAndClaim() {
    if (!surveyorId || !job?.id) return;

    try {
      // Record NDA acceptance
      const { error: ndaError } = await supabase
        .from('job_nda_acceptance')
        .insert([{
          job_id: job.id,
          surveyor_id: surveyorId,
        }]);

      if (ndaError) throw ndaError;

      // Claim the job
      const { error } = await supabase.rpc('claim_job', { p_job_id: jobId, p_surveyor_id: surveyorId });
      if (error) Alert.alert('Error', error.message);
      else {
        Alert.alert('Claimed!', 'Job is now assigned to you.');
        loadData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to claim job');
    }

    setShowNDA(false);
  }

  async function handBack() {
    Alert.alert('Hand Back Job', 'Are you sure? This will return the job to the map.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Hand Back', style: 'destructive', onPress: async () => {
        try {
          Alert.alert('Processing', 'Updating job...');
          const { data, error } = await supabase
            .from('jobs')
            .update({ surveyor_id: null, dispatch_state: 'red' })
            .eq('id', jobId)
            .select();

          if (error) {
            Alert.alert('Update Error', error.message);
            return;
          }

          Alert.alert('Success', 'Job handed back. Returning to map.');
          setTimeout(() => nav.goBack(), 500);
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Unknown error');
        }
      }},
    ]);
  }

  async function markFieldDataUploaded() {
    Alert.alert('Confirm', 'Mark field data as uploaded? This notifies the office.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        const { error } = await supabase.from('jobs').update({
          field_data_uploaded: true,
          field_data_uploaded_at: new Date().toISOString(),
          dispatch_state: 'yellow',
        }).eq('id', jobId);
        if (error) Alert.alert('Error', error.message);
        else { Alert.alert('Done', 'Field data marked as uploaded.'); loadData(); }
      }},
    ]);
  }

  function claimAllocatedJob() {
    if (!surveyorId) { Alert.alert('Error', 'Surveyor profile not found.'); return; }
    setShowNDA(true);
  }

  async function acceptNDAAndClaimAllocated() {
    if (!surveyorId || !job?.id) return;

    try {
      // Record NDA acceptance
      const { error: ndaError } = await supabase
        .from('job_nda_acceptance')
        .insert([{
          job_id: job.id,
          surveyor_id: surveyorId,
        }]);

      if (ndaError) throw ndaError;

      // Claim the allocated job
      const { error } = await supabase.from('jobs').update({
        surveyor_id: surveyorId,
        dispatch_state: 'orange',
      }).eq('id', jobId);
      if (error) Alert.alert('Error', error.message);
      else { Alert.alert('✅ Claimed!', 'Job is assigned to you.'); loadData(); }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to claim job');
    }

    setShowNDA(false);
  }

  async function rejectAllocatedJob() {
    Alert.alert('Reject Job', 'This will release the job back to other surveyors.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', onPress: async () => {
        const { error } = await supabase.from('jobs').update({
          allocated_surveyor_id: null,
          allocation_rejected_at: new Date().toISOString(),
        }).eq('id', jobId);
        if (error) Alert.alert('Error', error.message);
        else { Alert.alert('Done', 'Job returned to available list.'); nav.goBack(); }
      }, style: 'destructive' },
    ]);
  }

  async function saveNotes() {
    setSavingNotes(true);
    const { error } = await supabase.from('jobs').update({ surveyor_notes: notes }).eq('id', jobId);
    setSavingNotes(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Saved', 'Notes saved.');
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a3c2e" /></View>;
  if (!job) return <View style={s.center}><Text>Job not found.</Text></View>;

  const isMine = job.surveyor_id === surveyorId;
  const isAvailable = job.dispatch_state === 'red';

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, gap: 12 }}>

      {/* Allocated Job Alert */}
      {job.allocated_surveyor_id && !job.allocation_rejected_at && job.dispatch_state !== 'orange' && (
        <View style={s.allocatedBanner}>
          <Text style={s.allocatedTitle}>🚨 ALLOCATED TO YOU - ACTION REQUIRED</Text>
          <Text style={s.allocatedText}>This job has been specifically assigned to you. You must claim or reject it.</Text>
          <Text style={s.allocatedCountdown}>⏱ Respond within: {timeRemaining || 'calculating...'}</Text>
          <View style={s.allocatedActions}>
            <TouchableOpacity style={s.allocatedClaimBtn} onPress={claimAllocatedJob}>
              <Text style={s.allocatedClaimText}>✅ CLAIM JOB</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.allocatedRejectBtn} onPress={rejectAllocatedJob}>
              <Text style={s.allocatedRejectText}>❌ REJECT</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={s.card}>
        <Text style={s.ref}>{job.reference || 'No reference'}</Text>
        <Text style={s.type}>{SURVEY_LABELS[job.survey_type] || job.survey_type}</Text>
        <Text style={s.postcode}>{job.site_postcode || '—'}</Text>

        {isMine && job.site_lat && job.site_lng ? (
          <View style={{marginVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <Text style={s.body}>📍 {Number(job.site_lat).toFixed(5)}, {Number(job.site_lng).toFixed(5)}</Text>
            <TouchableOpacity
              onPress={() => {
                const coords = `${Number(job.site_lat).toFixed(5)}, ${Number(job.site_lng).toFixed(5)}`;
                Clipboard.setString(coords);
                Alert.alert('Copied', 'Coordinates copied to clipboard');
              }}
              style={{paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#dcfce7', borderRadius: 4}}
            >
              <Text style={{color: '#166534', fontSize: 12, fontWeight: '500'}}>Copy</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {(job.tree_count_band || enquiry?.tree_count_band) && (
          <View style={s.treeCountBadge}>
            <Text style={s.treeCountText}>🌳 {job.tree_count_band || enquiry?.tree_count_band} trees</Text>
          </View>
        )}

        {surveyor && (
          <View style={s.payBreakdown}>
            <Text style={s.payLabel}>Your pay breakdown:</Text>
            <Text style={s.payDetails}>
              ({1} travel + {surveyHours} survey) × £{surveyor.hourly_rate}/hr = £{((1 + surveyHours) * surveyor.hourly_rate).toFixed(2)}
            </Text>
            {job.urgency_state === 'red' && (
              <Text style={s.payBonus}>
                🎯 Urgent next-day: +20% = £{((1 + surveyHours) * surveyor.hourly_rate * 1.2).toFixed(2)}
              </Text>
            )}
          </View>
        )}

        {job.sla_deadline
          ? <Text style={s.sla}>SLA: {new Date(job.sla_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          : null}
      </View>

      {/* Site Access */}
      {isMine && job.site_access_notes ? (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Site Access</Text>
          <Text style={s.body}>{job.site_access_notes}</Text>
        </View>
      ) : null}

      {/* Client & Site Details */}
      {isMine && enquiry && (enquiry.access_details || enquiry.parking_details || enquiry.contact_name || enquiry.report_title) ? (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Client & Site Details</Text>
          {enquiry.contact_name && (
            <View style={{marginBottom: 10}}>
              <Text style={s.label}>Contact</Text>
              <Text style={s.body}>{enquiry.contact_name}</Text>
              {enquiry.contact_phone && <Text style={s.body}>{enquiry.contact_phone}</Text>}
            </View>
          )}
          {enquiry.report_title && (
            <View style={{marginBottom: 10}}>
              <Text style={s.label}>Report Title</Text>
              <Text style={s.body}>{enquiry.report_title}</Text>
            </View>
          )}
          {enquiry.access_details && (
            <View style={{marginBottom: 10}}>
              <Text style={s.label}>Access Details</Text>
              <Text style={s.body}>{enquiry.access_details}</Text>
            </View>
          )}
          {enquiry.parking_details && (
            <View style={{marginBottom: 10}}>
              <Text style={s.label}>Parking</Text>
              <Text style={s.body}>{enquiry.parking_details}</Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Parking Location Map */}
      {isMine && (job.parking_lat || enquiry?.parking_lat) ? (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Parking Location</Text>
          <ParkingLocationMap parkingLat={job.parking_lat || enquiry?.parking_lat} parkingLng={job.parking_lng || enquiry?.parking_lng} />
        </View>
      ) : isMine ? (
        <Text style={{padding: 16, color: '#999', fontSize: 12}}>📍 No parking location set</Text>
      ) : null}

      {/* Survey Date */}
      {job.survey_date ? (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Survey Date</Text>
          <Text style={s.body}>
            {new Date(job.survey_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' '}{job.survey_date_confirmed ? '✅ Confirmed' : '🟠 Proposed'}
          </Text>
        </View>
      ) : null}

      {/* Documents */}
      {(job.doc_block_plan_url || job.doc_topo_survey_url || job.doc_other_urls) ? (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Documents</Text>
          {job.doc_block_plan_url
            ? <TouchableOpacity style={s.docBtn} onPress={() => Linking.openURL(job.doc_block_plan_url!)}>
                <Text style={s.docBtnText}>📄 Block Plan</Text>
              </TouchableOpacity>
            : null}
          {job.doc_topo_survey_url
            ? <TouchableOpacity style={s.docBtn} onPress={() => Linking.openURL(job.doc_topo_survey_url!)}>
                <Text style={s.docBtnText}>📄 Topo Survey</Text>
              </TouchableOpacity>
            : null}
          {job.doc_other_urls
            ? <Text style={s.body}>{job.doc_other_urls}</Text>
            : null}
        </View>
      ) : null}

      {/* Surveyor notes */}
      {isMine && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Field Notes</Text>
          <TextInput
            style={s.notesInput}
            multiline
            numberOfLines={4}
            placeholder="Add your site notes here…"
            value={notes}
            onChangeText={setNotes}
          />
          <TouchableOpacity style={s.saveBtn} onPress={saveNotes} disabled={savingNotes}>
            <Text style={s.saveBtnText}>{savingNotes ? 'Saving…' : 'Save Notes'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Uploaded Files */}
      {isMine && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Uploaded Files</Text>
          {files.length === 0 ? (
            <Text style={s.body}>No files uploaded yet.</Text>
          ) : (
            files.map((f) => (
              <View key={f.id} style={s.fileItem}>
                <View style={s.fileInfo}>
                  <Text style={s.fileName}>{f.file_name}</Text>
                  <Text style={s.fileDate}>{new Date(f.uploaded_at).toLocaleDateString('en-GB')}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteFile(f.file_path)}>
                  <Text style={s.fileDelete}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          <TouchableOpacity style={s.uploadBtn} onPress={uploadFile} disabled={uploading}>
            <Text style={s.uploadBtnText}>{uploading ? 'Uploading…' : '📤 Upload File'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Actions */}
      <View style={s.actions}>
        {isAvailable && (
          <TouchableOpacity style={s.btnPrimary} onPress={claimJob}>
            <Text style={s.btnPrimaryText}>✅ Claim This Job</Text>
          </TouchableOpacity>
        )}
        {isMine && (
          <>
            {job.dispatch_state === 'orange' && (
              <TouchableOpacity style={s.btnPrimary} onPress={markFieldDataUploaded}>
                <Text style={s.btnPrimaryText}>📤 Mark Field Data Uploaded</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.btnSecondary} onPress={handBack}>
              <Text style={s.btnSecondaryText}>↩ Hand Back Job</Text>
            </TouchableOpacity>
          </>
        )}
        {isMine && job.dispatch_state === 'yellow' && (
          <View style={s.infoBox}>
            <Text style={s.infoText}>🟡 Field data uploaded. Awaiting report finalisation.</Text>
          </View>
        )}
      </View>

      <NDAModal
        visible={showNDA}
        onAccept={job?.allocated_surveyor_id ? acceptNDAAndClaimAllocated : acceptNDAAndClaim}
        onDismiss={() => setShowNDA(false)}
      />
    </ScrollView>
  );
}

const GREEN = '#1a3c2e';

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#f5f5f5' },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:          { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2 },
  ref:           { fontSize: 20, fontWeight: '700', color: GREEN, marginBottom: 4 },
  type:          { fontSize: 15, color: '#374151', marginBottom: 2 },
  postcode:      { fontSize: 14, color: '#6b7280' },
  pay:           { fontSize: 16, fontWeight: '700', color: '#16a34a', marginTop: 8 },
  sla:           { fontSize: 13, color: '#6b7280', marginTop: 4 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: GREEN, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  label:         { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' },
  body:          { fontSize: 14, color: '#374151', lineHeight: 20 },
  tag:           { fontSize: 12, color: '#6b7280', marginTop: 6, fontStyle: 'italic' },
  docBtn:        { backgroundColor: '#f0f7f4', borderRadius: 8, padding: 12, marginBottom: 8 },
  docBtnText:    { color: GREEN, fontWeight: '600', fontSize: 14 },
  notesInput:    { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: 8 },
  saveBtn:       { backgroundColor: '#e5f0eb', borderRadius: 8, padding: 10, alignItems: 'center' },
  saveBtnText:   { color: GREEN, fontWeight: '600', fontSize: 14 },
  actions:       { gap: 10, paddingBottom: 32 },
  btnPrimary:    { backgroundColor: GREEN, borderRadius: 12, padding: 16, alignItems: 'center' },
  btnPrimaryText:{ color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary:  { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db' },
  btnSecondaryText: { color: '#dc2626', fontSize: 15, fontWeight: '600' },
  infoBox:       { backgroundColor: '#fefce8', borderRadius: 12, padding: 16 },
  infoText:      { color: '#854d0e', fontSize: 14, textAlign: 'center' },
  fileItem:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  fileInfo:      { flex: 1 },
  fileName:      { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 2 },
  fileDate:      { fontSize: 12, color: '#9ca3af' },
  fileDelete:    { fontSize: 18, padding: 8 },
  uploadBtn:     { backgroundColor: '#e5f0eb', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 },
  uploadBtnText: { color: GREEN, fontWeight: '600', fontSize: 14 },
  payBreakdown:  { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  payLabel:      { fontSize: 12, color: '#6b7280', fontWeight: '600', marginBottom: 4 },
  payDetails:    { fontSize: 14, color: GREEN, fontWeight: '700', marginBottom: 4 },
  payBonus:      { fontSize: 13, color: '#16a34a', fontWeight: '600', marginTop: 6 },
  treeCountBadge: { backgroundColor: '#f0fdf4', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 8 },
  treeCountText:  { fontSize: 15, fontWeight: '700', color: '#15803d' },
  allocatedBanner: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: '#dc2626', marginBottom: 12 },
  allocatedTitle:  { fontSize: 16, fontWeight: '700', color: '#991b1b', marginBottom: 8 },
  allocatedText:   { fontSize: 14, color: '#7f1d1d', marginBottom: 8, lineHeight: 20 },
  allocatedCountdown: { fontSize: 15, fontWeight: '700', color: '#dc2626', marginBottom: 12 },
  allocatedActions: { flexDirection: 'row', gap: 10 },
  allocatedClaimBtn: { flex: 1, backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  allocatedClaimText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  allocatedRejectBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#dc2626' },
  allocatedRejectText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
});
