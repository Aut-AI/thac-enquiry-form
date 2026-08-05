import React, { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isValidDate } from '../lib/date';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7faf8',
  },
  header: {
    backgroundColor: '#1a3c2e',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  headerSubtext: {
    color: '#ccc',
    fontSize: 14,
  },
  form: {
    padding: 20,
    gap: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a3c2e',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  infoBox: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#1a3c2e',
    padding: 28,
    borderRadius: 6,
    marginTop: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#1a3c2e',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#374151',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#1a3c2e',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingButton: {
    opacity: 0.6,
  },
  signOutLink: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 40,
  },
  signOutText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
});

interface Props {
  session: Session;
  onComplete: () => void;
}

// Shown when a user is already logged in (valid Supabase session) but has no
// linked row in `surveyors` yet -- e.g. an admin created their auth account
// but they never finished the profile, or a previous registration attempt
// only got as far as auth.signUp(). Unlike RegisterScreen this never calls
// auth.signUp(): doing so while already authenticated always fails with
// Supabase's "email already registered" response, which used to surface here
// as a confusing error that discarded everything the user had just typed.
export function CompleteProfileScreen({ session, onComplete }: Props) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');
  const [radiusMiles, setRadiusMiles] = useState('');
  const [piPolicyNumber, setPiPolicyNumber] = useState('');
  const [piExpiryDate, setPiExpiryDate] = useState('');
  const [plPolicyNumber, setPlPolicyNumber] = useState('');
  const [plExpiryDate, setPlExpiryDate] = useState('');
  const [dbsNumber, setDbsNumber] = useState('');
  const [dbsExpiryDate, setDbsExpiryDate] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    setError('');

    if (!fullName || !postcode) {
      setError('Please fill in all required fields');
      submittingRef.current = false;
      return;
    }

    const dateFields: [string, string][] = [
      ['PI expiry date', piExpiryDate],
      ['PL expiry date', plExpiryDate],
      ['DBS expiry date', dbsExpiryDate],
    ];
    for (const [label, value] of dateFields) {
      if (value && !isValidDate(value)) {
        setError(`${label} must be a valid date in YYYY-MM-DD format`);
        submittingRef.current = false;
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        user_id: session.user.id,
        full_name: fullName,
        email: session.user.email,
        phone: phone || null,
        home_postcode: postcode,
        radius_miles: parseInt(radiusMiles) || 25,
        pi_policy_number: piPolicyNumber || null,
        pi_expiry_date: piExpiryDate || null,
        pl_policy_number: plPolicyNumber || null,
        pl_expiry_date: plExpiryDate || null,
        dbs_number: dbsNumber || null,
        dbs_expiry_date: dbsExpiryDate || null,
        qualifications: qualifications || null,
        status: 'pending',
        is_active: false,
      };

      const { error: dbError } = await supabase.from('surveyors').insert([payload]);
      if (dbError) throw new Error(dbError.message);

      Alert.alert(
        'Profile Submitted',
        'Your profile is awaiting admin approval. You will receive an email once approved.',
        [{ text: 'OK', onPress: onComplete }]
      );
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Complete Your Profile</Text>
          <Text style={styles.headerSubtext}>
            {session.user.email} is signed in but doesn't have a surveyor profile yet
          </Text>
        </View>

        <View style={styles.form}>
          {error ? <Text style={styles.errorText}>Error: {error}</Text> : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Details</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name *"
              placeholderTextColor="#9ca3af"
              value={fullName}
              onChangeText={setFullName}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone"
              placeholderTextColor="#9ca3af"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!loading}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coverage Area</Text>
            <TextInput
              style={styles.input}
              placeholder="Home Postcode *"
              placeholderTextColor="#9ca3af"
              value={postcode}
              onChangeText={setPostcode}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Coverage Radius (miles)"
              placeholderTextColor="#9ca3af"
              value={radiusMiles}
              onChangeText={setRadiusMiles}
              keyboardType="number-pad"
              editable={!loading}
            />
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 A larger radius helps you discover nearby jobs to group together — you're never obligated to accept any work
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Insurance</Text>
            <TextInput
              style={styles.input}
              placeholder="PI Policy Number"
              placeholderTextColor="#9ca3af"
              value={piPolicyNumber}
              onChangeText={setPiPolicyNumber}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="PI Expiry Date (YYYY-MM-DD)"
              placeholderTextColor="#9ca3af"
              value={piExpiryDate}
              onChangeText={setPiExpiryDate}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="PL Policy Number"
              placeholderTextColor="#9ca3af"
              value={plPolicyNumber}
              onChangeText={setPlPolicyNumber}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="PL Expiry Date (YYYY-MM-DD)"
              placeholderTextColor="#9ca3af"
              value={plExpiryDate}
              onChangeText={setPlExpiryDate}
              editable={!loading}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compliance</Text>
            <TextInput
              style={styles.input}
              placeholder="DBS Number"
              placeholderTextColor="#9ca3af"
              value={dbsNumber}
              onChangeText={setDbsNumber}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="DBS Expiry Date (YYYY-MM-DD)"
              placeholderTextColor="#9ca3af"
              value={dbsExpiryDate}
              onChangeText={setDbsExpiryDate}
              editable={!loading}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Qualifications</Text>
            <TextInput
              style={styles.input}
              placeholder="Qualifications"
              placeholderTextColor="#9ca3af"
              value={qualifications}
              onChangeText={setQualifications}
              multiline
              numberOfLines={2}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.loadingButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Saving...' : 'Submit Profile'}
            </Text>
          </TouchableOpacity>

          <View style={styles.signOutLink}>
            <Text
              style={styles.signOutText}
              onPress={() => supabase.auth.signOut()}
            >
              Not you? Sign out
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
