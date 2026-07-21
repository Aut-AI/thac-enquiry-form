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
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    marginTop: 8,
    lineHeight: 1.6,
    paddingHorizontal: 4,
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
  signInLink: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 40,
  },
  signInText: {
    color: '#666',
    fontSize: 14,
  },
  signInButton: {
    color: '#1a3c2e',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  rowInput: {
    flex: 1,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
});

export function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  // setLoading(true) below doesn't take effect (and disable the button) until
  // the next render, so two taps fired in the same tick both slip past the
  // `disabled={loading}` check and double-submit. This ref flips synchronously.
  const submittingRef = useRef(false);

  const handleRegister = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    setError('');

    if (!fullName || !email || !password || !postcode) {
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
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      // Supabase returns 200 with a decoy user object (no error, empty
      // identities array, no session) when signUp() is called with an email
      // that already has an account — this is deliberate, to stop attackers
      // enumerating registered emails. Trusting that decoy id here created
      // surveyors rows with a user_id pointing at a non-existent auth user,
      // leaving the real account permanently unable to see its own profile.
      if (authData.user && authData.user.identities?.length === 0) {
        throw new Error('An account with this email already exists. Please log in instead.');
      }

      const userId = authData.user?.id;
      if (!userId) throw new Error('Failed to create user');

      // Create surveyor record with pending status
      const payload = {
        user_id: userId,
        full_name: fullName,
        email,
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

      console.log('Inserting surveyor:', JSON.stringify(payload, null, 2));

      const { error: dbError } = await supabase.from('surveyors').insert([payload]);

      if (dbError) {
        console.error('DB Error details:', dbError);
        throw new Error(`Registration failed: ${dbError.message}`);
      }

      // If email confirmation is required, signUp() returns no session -- the
      // user isn't logged in yet. Otherwise a session already exists and
      // App.tsx's session/status effect will swap straight to
      // PendingApprovalScreen on its own once this alert closes.
      const hasSession = !!authData.session;

      Alert.alert(
        'Registration Successful',
        hasSession
          ? 'Your account is awaiting admin approval. You will receive an email once approved.'
          : 'Please check your email to confirm your account. Your registration is also awaiting admin approval — you will receive an email once approved.',
        [
          {
            text: 'OK',
            onPress: async () => {
              if (!hasSession) {
                // Sign out first in case a stale session from another
                // account is still active -- that would put App.tsx's
                // Stack.Navigator in the "logged in but no matching
                // surveyor" fallback branch, which has no Login screen in
                // it. The setTimeout gives that session-clear a tick to
                // flush and swap the navigator back to the Login+Register
                // stack before we ask it to go to Login (a no-op if there
                // was no stale session -- Login already exists and this
                // just runs on the next tick instead).
                await supabase.auth.signOut();
                setTimeout(() => navigation.replace('Login'), 0);
              }
            },
          },
        ]
      );
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      Alert.alert('Error', err.message || 'Registration failed');
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
          <Text style={styles.headerText}>Create Account</Text>
          <Text style={styles.headerSubtext}>
            Join our surveyor network
          </Text>
        </View>

        <View style={styles.form}>
          {error ? <Text style={styles.errorText}>Error: {error}</Text> : null}

          {/* Contact Information */}
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
              placeholder="Email *"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password *"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
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

          {/* Location & Coverage */}
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

          {/* Insurance */}
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

          {/* Compliance */}
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

          {/* Qualifications */}
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
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating account...' : 'Register'}
            </Text>
          </TouchableOpacity>

          <View style={styles.signInLink}>
            <Text style={styles.signInText}>
              Already have an account?{' '}
              <Text
                style={styles.signInButton}
                onPress={async () => {
                  await supabase.auth.signOut();
                  navigation.replace('Login');
                }}
              >
                Sign In
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
