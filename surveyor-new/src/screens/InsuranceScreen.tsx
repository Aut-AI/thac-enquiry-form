import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { isValidDate } from '../lib/date';
import { useSurveyorProfile } from '../lib/useSurveyorProfile';
import { pickCertificate, uploadCertificate, openCertificate, CertificateType, certificateLabel } from '../lib/certificateUpload';
import { sharedStyles as s } from '../lib/profileStyles';

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

export default function InsuranceScreen() {
  const { surveyor, loading, reload } = useSurveyorProfile();
  const [uploadingCert, setUploadingCert] = useState<CertificateType | null>(null);
  const [editPiExpiry, setEditPiExpiry] = useState('');
  const [editPlExpiry, setEditPlExpiry] = useState('');
  const [editDbsExpiry, setEditDbsExpiry] = useState('');
  const [savingInsurance, setSavingInsurance] = useState(false);

  useEffect(() => {
    if (surveyor) {
      setEditPiExpiry(surveyor.pi_expiry_date || '');
      setEditPlExpiry(surveyor.pl_expiry_date || '');
      setEditDbsExpiry(surveyor.dbs_expiry_date || '');
    }
  }, [surveyor]);

  async function replaceCertificate(type: CertificateType) {
    if (!surveyor) return;
    const file = await pickCertificate();
    if (!file) return;

    setUploadingCert(type);
    try {
      const path = await uploadCertificate(surveyor.id, type, file);
      const column = `${type}_certificate_path`;
      const { error } = await supabase.from('surveyors').update({ [column]: path }).eq('id', surveyor.id);
      if (error) throw error;
      Alert.alert('Uploaded', `${certificateLabel(type)} has been updated.`);
      await reload();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploadingCert(null);
    }
  }

  async function saveInsuranceDates() {
    if (!surveyor) return;

    const dateFields: [string, string][] = [
      ['PI expiry date', editPiExpiry],
      ['PL expiry date', editPlExpiry],
      ['DBS expiry date', editDbsExpiry],
    ];
    for (const [label, value] of dateFields) {
      if (value && !isValidDate(value)) {
        Alert.alert('Error', `${label} must be a valid date in YYYY-MM-DD format`);
        return;
      }
    }

    setSavingInsurance(true);

    try {
      const { error } = await supabase
        .from('surveyors')
        .update({
          pi_expiry_date: editPiExpiry || null,
          pl_expiry_date: editPlExpiry || null,
          dbs_expiry_date: editDbsExpiry || null,
        })
        .eq('id', surveyor.id);

      if (error) throw error;
      Alert.alert('Saved', 'Insurance expiry dates have been updated.');
      await reload();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingInsurance(false);
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a3c2e" /></View>;
  if (!surveyor) return <View style={s.center}><Text style={s.hint}>No surveyor profile found.</Text></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.sectionTitle}>Insurance & Compliance</Text>

        <View style={styles.editGroup}>
          <View style={styles.editItem}>
            <Text style={s.label}>PI Expiry Date (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD"
              value={editPiExpiry}
              onChangeText={setEditPiExpiry}
              editable={!savingInsurance}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.editItem}>
            <Text style={s.label}>PL Expiry Date (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD"
              value={editPlExpiry}
              onChangeText={setEditPlExpiry}
              editable={!savingInsurance}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.editItem}>
            <Text style={s.label}>DBS Expiry Date (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD"
              value={editDbsExpiry}
              onChangeText={setEditDbsExpiry}
              editable={!savingInsurance}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <TouchableOpacity
            style={[s.saveBtn, savingInsurance && s.saveBtnDisabled]}
            onPress={saveInsuranceDates}
            disabled={savingInsurance}
          >
            <Text style={s.saveBtnText}>{savingInsurance ? 'Saving...' : 'Save Dates'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.divider} />

        <View style={styles.row}>
          <View style={styles.item}>
            <Text style={styles.light}>{trafficLight(surveyor.pi_expiry_date)}</Text>
            <Text style={styles.itemLabel}>PI Insurance</Text>
            <Text style={styles.itemDate}>{formatDate(surveyor.pi_expiry_date)}</Text>
            <TouchableOpacity onPress={() => surveyor.pi_certificate_path ? openCertificate(surveyor.pi_certificate_path) : replaceCertificate('pi')}>
              <Text style={styles.certLink}>
                {uploadingCert === 'pi' ? 'Uploading...' : surveyor.pi_certificate_path ? 'View file' : 'Upload file'}
              </Text>
            </TouchableOpacity>
            {surveyor.pi_certificate_path ? (
              <TouchableOpacity onPress={() => replaceCertificate('pi')}>
                <Text style={styles.certLinkSecondary}>Replace</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.item}>
            <Text style={styles.light}>{trafficLight(surveyor.pl_expiry_date)}</Text>
            <Text style={styles.itemLabel}>PL Insurance</Text>
            <Text style={styles.itemDate}>{formatDate(surveyor.pl_expiry_date)}</Text>
            <TouchableOpacity onPress={() => surveyor.pl_certificate_path ? openCertificate(surveyor.pl_certificate_path) : replaceCertificate('pl')}>
              <Text style={styles.certLink}>
                {uploadingCert === 'pl' ? 'Uploading...' : surveyor.pl_certificate_path ? 'View file' : 'Upload file'}
              </Text>
            </TouchableOpacity>
            {surveyor.pl_certificate_path ? (
              <TouchableOpacity onPress={() => replaceCertificate('pl')}>
                <Text style={styles.certLinkSecondary}>Replace</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.item}>
            <Text style={styles.light}>{trafficLight(surveyor.dbs_expiry_date)}</Text>
            <Text style={styles.itemLabel}>DBS Check</Text>
            <Text style={styles.itemDate}>{formatDate(surveyor.dbs_expiry_date)}</Text>
            <TouchableOpacity onPress={() => surveyor.dbs_certificate_path ? openCertificate(surveyor.dbs_certificate_path) : replaceCertificate('dbs')}>
              <Text style={styles.certLink}>
                {uploadingCert === 'dbs' ? 'Uploading...' : surveyor.dbs_certificate_path ? 'View file' : 'Upload file'}
              </Text>
            </TouchableOpacity>
            {surveyor.dbs_certificate_path ? (
              <TouchableOpacity onPress={() => replaceCertificate('dbs')}>
                <Text style={styles.certLinkSecondary}>Replace</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const GREEN = '#1a3c2e';

const styles = StyleSheet.create({
  editGroup: { marginBottom: 16 },
  editItem: { marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  item: { alignItems: 'center', gap: 4 },
  light: { fontSize: 28 },
  itemLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', textAlign: 'center' },
  itemDate: { fontSize: 11, color: '#9ca3af', textAlign: 'center' },
  certLink: { fontSize: 12, color: GREEN, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  certLinkSecondary: { fontSize: 11, color: '#6b7280', fontWeight: '500', marginTop: 4, textAlign: 'center' },
});
