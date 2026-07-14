import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getGlassCardStyle } from '@/components/ui/glass-styles';

type SettingsSectionProps = {
  title?: string;
  children: ReactNode;
  /** When true, renders children directly on the gradient without an outer card. */
  unframed?: boolean;
};

export function SettingsSection({ title, children, unframed = false }: SettingsSectionProps) {
  return (
    <View style={[styles.section, unframed && styles.sectionUnframed]}>
      {title ? (
        <Text className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </Text>
      ) : null}
      {unframed ? children : <View style={getGlassCardStyle()}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionUnframed: {
    alignSelf: 'stretch',
  },
});
