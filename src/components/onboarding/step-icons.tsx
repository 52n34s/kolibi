import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import {
  type ActivityLevel,
  type BiologicalSex,
  type GoalType,
} from '@/lib/onboarding';

import { getOptionIconColor } from './option-card';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ICON_SIZE_ROW = 26;
const ICON_SIZE_GRID = 28;

function OptionIcon({ name, size }: { name: IoniconName; size: number }) {
  return <Ionicons name={name} size={size} color={getOptionIconColor()} />;
}

export function SexOptionIcon({
  option,
  selected: _selected,
}: {
  option: BiologicalSex;
  selected: boolean;
}) {
  const icons: Record<BiologicalSex, IoniconName> = {
    male: 'male-outline',
    female: 'female-outline',
    prefer_not_to_say: 'help-circle-outline',
  };

  return <OptionIcon name={icons[option]} size={ICON_SIZE_ROW} />;
}

export function ActivityOptionIcon({
  level,
  selected: _selected,
}: {
  level: ActivityLevel;
  selected: boolean;
}) {
  const icons: Record<ActivityLevel, IoniconName> = {
    mostly_sitting: 'desktop-outline',
    lightly_active: 'footsteps-outline',
    active: 'bicycle-outline',
    very_active: 'flash-outline',
  };

  return <OptionIcon name={icons[level]} size={ICON_SIZE_GRID} />;
}

export function GoalOptionIcon({
  goal,
  selected: _selected,
}: {
  goal: GoalType;
  selected: boolean;
}) {
  const icons: Record<GoalType, IoniconName> = {
    maintain: 'speedometer-outline',
    lose_weight: 'trending-down-outline',
    gain_weight: 'trending-up-outline',
    faster_weight_loss: 'arrow-down-circle-outline',
    custom: 'create-outline',
  };

  return <OptionIcon name={icons[goal]} size={ICON_SIZE_GRID} />;
}
