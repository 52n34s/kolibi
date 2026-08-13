import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { GLASS_SURFACE } from '@/components/ui/glass-styles';

export const DIET_PREFERENCE_OPTIONS = [
  { id: 'none', value: null },
  { id: 'omnivore', value: 'omnivore' },
  { id: 'pescatarian', value: 'pescatarian' },
  { id: 'vegetarian', value: 'vegetarian' },
  { id: 'vegan', value: 'vegan' },
] as const;

export const CUISINE_CONTEXT_OPTIONS = [
  'western',
  'mediterranean',
  'east_asian',
  'south_asian',
  'latin_american',
  'african',
] as const;

export type DietPreferenceValue = (typeof DIET_PREFERENCE_OPTIONS)[number]['value'];
export type CuisineContextValue = (typeof CUISINE_CONTEXT_OPTIONS)[number];

type CuisineMultiSelectChipsProps = {
  values: string[];
  labels: Record<string, string>;
  onChange: (next: string[]) => void;
};

export function CuisineMultiSelectChips({
  values,
  labels,
  onChange,
}: CuisineMultiSelectChipsProps) {
  const selected = new Set(values);

  function toggle(id: string) {
    if (selected.has(id)) {
      onChange(values.filter((value) => value !== id));
      return;
    }

    onChange([...values, id]);
  }

  return (
    <View style={styles.pillWrap}>
      {CUISINE_CONTEXT_OPTIONS.map((id) => {
        const isActive = selected.has(id);

        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={labels[id]}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => toggle(id)}>
            <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>
              {labels[id]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 4,
    backgroundColor: GLASS_SURFACE.backgroundColor,
    borderColor: GLASS_SURFACE.borderColor,
    borderWidth: GLASS_SURFACE.borderWidth,
    borderRadius: 12,
    alignSelf: 'stretch',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  pillActive: {
    backgroundColor: ONBOARDING_ACCENT,
  },
  pillLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillLabelActive: {
    fontSize: 12,
    color: '#FFFFFF',
  },
});
