// ─── Cross-platform confirmation dialog ─────────────────────────────────────
// react-native-web ships `Alert` as a stub whose `alert()` method does nothing
// at all (see react-native-web/dist/exports/Alert). Any code that relies on an
// Alert button callback to continue therefore dead-ends on web — and Circuit
// runs as a web PWA, so that is the only platform that matters in practice.
//
// This routes to window.confirm on web (iOS Safari renders it as a real system
// dialog) and to Alert on native, and always resolves so callers can await it
// instead of hanging on a callback that will never fire.

import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label for the affirmative action. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the affirmative action as destructive on native. */
  destructive?: boolean;
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    destructive = false,
  } = options;

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      // No way to ask: refuse rather than silently taking a destructive action.
      return Promise.resolve(false);
    }
    // window.confirm can only label its buttons OK/Cancel, so fold the intent
    // into the text to keep the choice unambiguous.
    const body = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(window.confirm(`${body}\n\nOK = ${confirmLabel}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
