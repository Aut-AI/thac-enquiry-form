import { StyleSheet } from 'react-native';

export const GREEN = '#1a3c2e';

// Shared across ProfileScreen and its sub-pages (CoverageArea, Insurance,
// Availability) so the same card/form/button look doesn't get redefined in
// each file. Screen-specific styles (e.g. a particular row layout) stay
// local to that screen.
export const sharedStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: GREEN, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
  hint: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  helperText: { fontSize: 12, color: '#6b7280', marginTop: -8, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: GREEN, marginBottom: 6 },
  input: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#374151', marginBottom: 12 },
  saveBtn: { backgroundColor: GREEN, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 16 },
  signOutBtn: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  signOutText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
});
