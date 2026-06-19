import React, { useState } from 'react';
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
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a3c2e',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
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
  const [radiusMiles, setRadiusMiles] = useState('25');
  const [piPolicyNumber, setPiPolicyNumber] = useState('');
  const [piExpiryDate, setPiExpiryDate] = useState('');
  const [plPolicyNumber, setPlPolicyNumber] = useState('');
  const [plExpiryDate, setPlExpiryDate] = useState('');
  const [dbsNumber, setDbsNumber] = useState('');
  const [dbsExpiryDate, setDbsExpiryDate] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');

    if (!fullName || !email || !password || !postcode) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

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

      Alert.alert(
        'Registration Successful',
        'Your account is awaiting admin approval. You will receive an email once approved.',
        [{ text: 'OK', onPress: () => navigation.replace('PendingApproval') }]
      );
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      Alert.alert('Error', err.message || 'Registration failed');
    } finally {
      setLoading(false);
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
              value={fullName}
              onChangeText={setFullName}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Email *"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password *"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone"
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
              value={postcode}
              onChangeText={setPostcode}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Coverage Radius (miles)"
              value={radiusMiles}
              onChangeText={setRadiusMiles}
              keyboardType="number-pad"
              editable={!loading}
            />
          </View>

          {/* Insurance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Insurance</Text>
            <TextInput
              style={styles.input}
              placeholder="PI Policy Number"
              value={piPolicyNumber}
              onChangeText={setPiPolicyNumber}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="PI Expiry Date (YYYY-MM-DD)"
              value={piExpiryDate}
              onChangeText={setPiExpiryDate}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="PL Policy Number"
              value={plPolicyNumber}
              onChangeText={setPlPolicyNumber}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="PL Expiry Date (YYYY-MM-DD)"
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
              value={dbsNumber}
              onChangeText={setDbsNumber}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="DBS Expiry Date (YYYY-MM-DD)"
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
                onPress={() => navigation.navigate('Login')}
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
