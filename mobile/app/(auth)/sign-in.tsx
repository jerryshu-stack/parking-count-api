import { useCallback, useState } from 'react';
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { ApiError, APP_NAME } from '@/api/client';
import { useAuth } from '@/features/auth/AuthContext';
import { color, radius, space } from '@/theme/tokens';
import { text as type } from '@/theme/type';

/**
 * Username and password only. The backend has exactly one credential provider
 * (`auth_credentials.provider = 'password'`), so offering Apple or Google here
 * would be a button that cannot work.
 */

const HERO = require('../../assets/taipei-hero.jpg');

// Tall enough to establish place, short enough that the form never needs scrolling.
const HERO_HEIGHT = Math.round(
  Math.min(360, Math.max(226, Dimensions.get('window').height * 0.38)),
);

function messageFor(error: unknown, mode: 'signIn' | 'signUp'): string {
  if (!(error instanceof ApiError)) return '發生問題，請再試一次';
  switch (error.kind) {
    case 'network':
      return '連線失敗，請稍後再試';
    case 'unauthorized':
      return '使用者名稱或密碼不正確';
    case 'conflict':
      return '這個使用者名稱已經有人使用';
    case 'invalid':
      return mode === 'signUp' ? '密碼至少需要 6 個字元' : '請確認輸入的內容';
    default:
      return '伺服器暫時無法回應，請稍後再試';
  }
}

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = username.trim().length > 0 && password.length > 0;

  const submit = useCallback(async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const run = mode === 'signIn' ? signIn : signUp;
      await run(username.trim(), password);
    } catch (e) {
      setError(messageFor(e, mode));
    } finally {
      setBusy(false);
    }
  }, [ready, busy, mode, username, password, signIn, signUp]);

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Image source={HERO} style={styles.hero} resizeMode="cover" />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
          <Text variant="title" style={styles.brand}>
            {APP_NAME}
          </Text>
          <Text variant="body" tone="secondary" style={styles.tagline}>
            找車位，也分享你看到的車位。
          </Text>

          <View style={styles.form}>
            <Field
              label="使用者名稱"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              returnKeyType="next"
            />
            <View style={styles.gap} />
            <Field
              label="密碼"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>

          {error ? (
            <Text variant="meta" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button
            label={mode === 'signIn' ? '登入' : '建立帳號'}
            onPress={submit}
            disabled={!ready}
            loading={busy}
            style={styles.submit}
          />

          <Pressable
            onPress={() => {
              setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
              setError(null);
            }}
            style={styles.toggle}
          >
            <Text variant="meta" tone="secondary">
              {mode === 'signIn' ? '還沒有帳號？' : '已經有帳號？'}
              <Text variant="meta" tone="accent">
                {mode === 'signIn' ? '建立一個' : '登入'}
              </Text>
            </Text>
          </Pressable>

          <Text variant="caption" tone="tertiary" style={styles.footnote}>
            資料來源包含政府公開資料與社群回報
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Label above a rule, not a boxed input -- fewer containers, same affordance. */
function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View>
      <Text variant="caption" tone="tertiary" style={styles.fieldLabel}>
        {label}
      </Text>
      <TextInput {...props} style={styles.input} placeholderTextColor={color.inkTertiary} />
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  scroll: { flexGrow: 1 },

  hero: { width: '100%', height: HERO_HEIGHT },

  // The one container on this screen, and it earns it: it lifts the form off the
  // photograph so the text is legible without a scrim over the image.
  sheet: {
    flex: 1,
    marginTop: -28,
    backgroundColor: color.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.lg + space.xs,
  },

  brand: { letterSpacing: -0.6 },
  tagline: { marginTop: space.xs + 2 },

  form: { marginTop: space.xl },
  gap: { height: space.base },
  fieldLabel: { marginBottom: space.xs + 2 },
  input: { ...type.body, color: color.ink, paddingVertical: space.xs + 2, paddingHorizontal: 0 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairlineStrong },

  error: { marginTop: space.base, color: color.none },
  submit: { marginTop: space.lg },
  toggle: { marginTop: space.base, alignItems: 'center', paddingVertical: space.xs },
  footnote: { marginTop: space.lg, textAlign: 'center' },
});
