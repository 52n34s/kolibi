import { CompactSegmentToggle } from '@/components/settings/compact-segment-toggle';
import type { UnitSystem } from '@/lib/unit-system';

type UnitSystemToggleProps = {
  unitSystem: UnitSystem;
  metricLabel: string;
  imperialLabel: string;
  onChange: (unitSystem: UnitSystem) => void;
};

export function UnitSystemToggle({
  unitSystem,
  metricLabel,
  imperialLabel,
  onChange,
}: UnitSystemToggleProps) {
  return (
    <CompactSegmentToggle
      variant="unit"
      value={unitSystem}
      segments={[
        { id: 'metric', label: metricLabel },
        { id: 'imperial', label: imperialLabel },
      ]}
      onChange={(value) => onChange(value as UnitSystem)}
    />
  );
}
