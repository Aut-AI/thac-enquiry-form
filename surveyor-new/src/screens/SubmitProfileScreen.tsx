import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { isValidDate } from '../lib/date';
import { Surveyor } from '../types';
import { sharedStyles as s, GREEN } from '../lib/profileStyles';
import { pickCertificate, uploadCertificate, openCertificate, CertificateType, certificateLabel } from '../lib/certificateUpload';

// Shown to a newly registered surveyor until they submit a COMPLETE profile
// (Trevor, 16 Nov 2026). They can save a draft, come back, and only reach the
// office for approval once every field below is filled in.

type Draft = {
  phone: string; qualifications: string;
  pi_policy_number: string; pi_expiry_date: string; pi_cover_amount: string;
  pl_policy_number: string; pl_expiry_date: string; pl_cover_amount: string;
  dbs_number: string; dbs_expiry_date: string;
};

const toDraft = (r: Surveyor): Draft => ({
  phone: r.phone ?? '', qualifications: r.qualifications ?? '',
  pi_policy_number: r.pi_policy_number ?? '', pi_expiry_date: r.pi_expiry_date ?? '',
  pi_cover_amount: r.pi_cover_amount != null ? String(r.pi_cover_amount) : '',
  pl_policy_number: r.pl_policy_number ?? '', pl_expiry_date: r.pl_expiry_date ?? '',
  pl_cover_amount: r.pl_cover_amount != null ? String(r.pl_cover_amount) : '',
  dbs_number: r.dbs_number ?? '', dbs_expiry_date: r.dbs_expiry_date ?? '',
});

export function SubmitProfileScreen({ session, onSubmitted }: { session: any; onSubmitted: () => void }) {
  const [row, setRow] = useState<Surveyor | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<CertificateType | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('surveyors').select('*').eq('user_id', session.user.id).maybeSingle();
    if (error) Alert.alert('Error', error.message);
    if (data) { setRow(data as Surveyor); setD(prev => prev ?? toDraft(data as Surveyor)); }
  }, [session.user.id]);
  useEffect(() => { load(); }, [load]);

  if (!row || !d) return <View style={s.center}><ActivityIndicator size="large" color={GREEN} /></View>;

  const set = (k: keyof Draft) => (v: string) => setD({ ...d, [k]: v });
  const certPath = (t: CertificateType) => (row as any)[`${t}_certificate_path`] as string | null;

  // What is still missing, in plain words.
  const missing = (): string[] => {
    const m: string[] = [];
    const need = (ok: boolean, what: string) => { if (!ok) m.push(what); };
    need(!!d.phone.trim(), 'Phone number');
    need(!!d.qualifications.trim(), 'Qualifications');
    for (const [t, label] of [['pi', 'Professional Indemnity (PI)'], ['pl', 'Public Liability (PL)']] as const) {
      need(!!(d as any)[`${t}_policy_number`].trim(), `${label}: policy number`);
      need(isValidDate((d as any)[`${t}_expiry_date`]), `${label}: expiry date (YYYY-MM-DD)`);
      need(Number((d as any)[`${t}_cover_amount`]) > 0, `${label}: amount of cover (£)`);
      need(!!certPath(t), `${label}: certificate file`);
    }
    need(!!d.dbs_number.trim(), 'DBS: certificate number');
    need(isValidDate(d.dbs_expiry_date), 'DBS: expiry date (YYYY-MM-DD)');
    need(!!certPath('dbs'), 'DBS: certificate file');
    return m;
  };
  const todo = missing();

  const fields = () => ({
    phone: d.phone.trim() || null, qualifications: d.qualifications.trim() || null,
    pi_policy_number: d.pi_policy_number.trim() || null, pi_expiry_date: isValidDate(d.pi_expiry_date) ? d.pi_expiry_date : null,
    pi_cover_amount: Number(d.pi_cover_amount) > 0 ? Number(d.pi_cover_amount) : null,
    pl_policy_number: d.pl_policy_number.trim() || null, pl_expiry_date: isValidDate(d.pl_expiry_date) ? d.pl_expiry_date : null,
    pl_cover_amount: Number(d.pl_cover_amount) > 0 ? Number(d.pl_cover_amount) : null,
    dbs_number: d.dbs_number.trim() || null, dbs_expiry_date: isValidDate(d.dbs_expiry_date) ? d.dbs_expiry_date : null,
  });

  async function saveDraft(silent = false) {
    const { error } = await supabase.from('surveyors').update(fields()).eq('id', row!.id);
    if (error) throw error;
    if (!silent) Alert.alert('Saved', 'Your progress is saved. You can come back and finish later.');
  }

  async function onSave() {
    setBusy(true);
    try { await saveDraft(); } catch (e: any) { Alert.alert('Error', e.message); } finally { setBusy(false); }
  }

  async function onSubmit() {
    if (todo.length) { Alert.alert('Not complete yet', 'Still to do:\n\n• ' + todo.join('\n• ')); return; }
    setBusy(true);
    try {
      await saveDraft(true);
      const { error } = await supabase.from('surveyors').update({ profile_submitted_at: new Date().toISOString() }).eq('id', row!.id);
      if (error) throw error;
      onSubmitted();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setBusy(false); }
  }

  async function onUpload(t: CertificateType) {
    const file = await pickCertificate();
    if (!file) return;
    setUploading(t);
    try {
      const path = await uploadCertificate(row!.id, t, file);
      const { error } = await supabase.from('surveyors').update({ [`${t}_certificate_path`]: path }).eq('id', row!.id);
      if (error) throw error;
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setUploading(null); }
  }

  const certRow = (t: CertificateType) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <TouchableOpacity style={[s.saveBtn, { marginTop: 0, backgroundColor: certPath(t) ? '#4b7a64' : GREEN, flex: 1 }]} onPress={() => onUpload(t)} disabled={uploading !== null}>
        <Text style={s.saveBtnText}>{uploading === t ? 'Uploading...' : certPath(t) ? 'Replace file' : `Upload ${certificateLabel(t)}`}</Text>
      </TouchableOpacity>
      {certPath(t) ? (
        <TouchableOpacity onPress={() => openCertificate(certPath(t)!).catch((e: any) => Alert.alert('Error', e.message))}>
          <Text style={{ color: GREEN, fontWeight: '700', textDecorationLine: 'underline' }}>View</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const insurance = (t: 'pi' | 'pl', title: string) => (
    <View style={s.card}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.label}>Policy number *</Text>
      <TextInput style={s.input} value={(d as any)[`${t}_policy_number`]} onChangeText={set(`${t}_policy_number` as keyof Draft)} />
      <Text style={s.label}>Expiry date * (YYYY-MM-DD)</Text>
      <TextInput style={s.input} value={(d as any)[`${t}_expiry_date`]} onChangeText={set(`${t}_expiry_date` as keyof Draft)} placeholder="2027-12-31" autoCapitalize="none" />
      <Text style={s.label}>Amount of cover (£) *</Text>
      <TextInput style={s.input} value={(d as any)[`${t}_cover_amount`]} onChangeText={set(`${t}_cover_amount` as keyof Draft)} keyboardType="number-pad" placeholder="e.g. 1000000" />
      {certRow(t)}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.container}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: 56 }]} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 24, fontWeight: '700', color: GREEN }}>Complete your profile</Text>
        <Text style={s.hint}>
          Fill in everything below and press Submit. The office only sees your registration once the profile is complete.
          You can save your progress and come back later.
        </Text>

        <View style={s.card}>
          <Text style={s.sectionTitle}>About you</Text>
          <Text style={s.label}>Phone *</Text>
          <TextInput style={s.input} value={d.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Text style={s.label}>Qualifications *</Text>
          <TextInput style={[s.input, { minHeight: 70 }]} value={d.qualifications} onChangeText={set('qualifications')} multiline />
        </View>

        {insurance('pi', 'Professional Indemnity (PI)')}
        {insurance('pl', 'Public Liability (PL)')}

        <View style={s.card}>
          <Text style={s.sectionTitle}>DBS check</Text>
          <Text style={s.label}>Certificate number *</Text>
          <TextInput style={s.input} value={d.dbs_number} onChangeText={set('dbs_number')} />
          <Text style={s.label}>Expiry date * (YYYY-MM-DD)</Text>
          <TextInput style={s.input} value={d.dbs_expiry_date} onChangeText={set('dbs_expiry_date')} placeholder="2027-12-31" autoCapitalize="none" />
          {certRow('dbs')}
        </View>

        {todo.length ? (
          <View style={[s.card, { backgroundColor: '#fff8e1' }]}>
            <Text style={[s.label, { marginBottom: 4 }]}>Still to do ({todo.length})</Text>
            {todo.map(t => <Text key={t} style={{ fontSize: 13, color: '#5c4a00' }}>• {t}</Text>)}
          </View>
        ) : null}

        <TouchableOpacity style={[s.saveBtn, { backgroundColor: '#4b7a64' }, busy && s.saveBtnDisabled]} onPress={onSave} disabled={busy}>
          <Text style={s.saveBtnText}>Save progress</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.saveBtn, (busy || todo.length > 0) && s.saveBtnDisabled]} onPress={onSubmit} disabled={busy}>
          <Text style={s.saveBtnText}>Submit for approval</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.signOutBtn} onPress={() => supabase.auth.signOut()}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
