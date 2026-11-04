import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Input } from '@/components/common';
import { colors, spacing, typography } from '@/theme';
import { restoreMissingWeights, WEIGHT_RECOVERY_FORMAT } from '@/utils/weightRecovery';

export function RestoreWeighIns() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);

  async function restore() {
    if (writing.current) return;
    let rows: unknown;
    try {
      const packet = JSON.parse(text.trim());
      if (packet?.format !== WEIGHT_RECOVERY_FORMAT) throw new Error();
      rows = packet.entries;
    } catch {
      setError('Copy the entire recovery block, then paste it here.');
      return;
    }
    writing.current = true;
    setBusy(true);
    setError('');
    try {
      const count = await restoreMissingWeights(rows);
      setNotice(count === 0 ? 'These dates are already in your tracker.' :
        `Restored ${count} ${count === 1 ? 'weigh-in' : 'weigh-ins'} on this device.`);
      setOpen(false);
      setText('');
    } catch {
      setError('Could not restore these weigh-ins. Check the pasted records and try again.');
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  if (!open) return (
    <View>
      {!!notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
      <TouchableOpacity accessibilityRole="button" style={styles.toggle} onPress={() => {
        setNotice('');
        setError('');
        setOpen(true);
      }}>
        <Text style={styles.link}>Restore weigh-ins</Text>
      </TouchableOpacity>
    </View>
  );
  return (
    <View style={styles.form}>
      <Input
        label="Restore missing weigh-ins"
        accessibilityLabel="Recovery text"
        placeholder="Paste recovery text"
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        editable={!busy}
        maxLength={250000}
        value={text}
        onChangeText={value => {
          setText(value);
          setError('');
        }}
        error={error}
        helper="Restore adds only dates missing from this tracker."
      />
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" style={styles.toggle} disabled={busy} onPress={() => {
          setText('');
          setOpen(false);
        }}>
          <Text style={styles.link}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.confirm} disabled={busy || !text.trim()} onPress={restore}>
          <Text style={styles.confirmText}>{busy ? 'Restoring…' : 'Restore'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, marginTop: spacing.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  toggle: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  link: { color: colors.primaryLight, fontSize: typography.sm },
  confirm: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, backgroundColor: colors.primaryDark, borderRadius: 12 },
  confirmText: { fontWeight: '600', color: colors.text },
  notice: { marginTop: spacing.sm, textAlign: 'center', color: colors.textSecondary },
});
