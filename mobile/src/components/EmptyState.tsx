import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { space } from '@/theme/tokens';

interface Props {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Every empty, denied, failed and locked state on any screen uses this. */
export function EmptyState({ title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <Text variant="rowTitle" style={styles.title}>
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="secondary" style={styles.body}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.xl, paddingVertical: space.xxl, alignItems: 'center' },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', marginTop: space.sm, maxWidth: 300 },
  action: { marginTop: space.lg, alignSelf: 'stretch', maxWidth: 280 },
});
