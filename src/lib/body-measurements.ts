import type { BodyMeasurementRow, BodyMeasurementValues } from '@/lib/body-measurements-core';
import type { DatedValue } from '@/lib/build-up';
import { createSchemaProbe, isMissingSchemaError } from '@/lib/db-schema-errors';
import { supabase } from '@/lib/supabase';

/**
 * body_measurements comes with migration 20260926153500. Until it runs, the
 * measurements sheet stays hidden; the build-up card works with weight,
 * waist (waist_logs) and training alone.
 */
export const hasBodyMeasurementsTable = createSchemaProbe(() =>
  supabase.from('body_measurements').select('id').limit(0),
);

const VALUES_SELECT = 'measured_on, chest_cm, arm_cm, hip_cm, thigh_cm';

type Row = {
  measured_on: string;
  chest_cm: number | string | null;
  arm_cm: number | string | null;
  hip_cm: number | string | null;
  thigh_cm: number | string | null;
};

function positiveNumber(value: number | string | null): number | null {
  if (value == null) {
    return null;
  }
  const cm = Number(value);
  return Number.isFinite(cm) && cm > 0 ? cm : null;
}

function mapRow(row: Row): BodyMeasurementRow {
  return {
    measured_on: row.measured_on,
    chest_cm: positiveNumber(row.chest_cm),
    arm_cm: positiveNumber(row.arm_cm),
    hip_cm: positiveNumber(row.hip_cm),
    thigh_cm: positiveNumber(row.thigh_cm),
  };
}

export async function fetchBodyMeasurementForDay(
  userId: string,
  measuredOn: string,
): Promise<BodyMeasurementValues | null> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select(VALUES_SELECT)
    .eq('user_id', userId)
    .eq('measured_on', measuredOn)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      return null;
    }
    throw error;
  }
  return data ? mapRow(data as Row) : null;
}

/** Rows on or after `sinceKey`, oldest first. Empty until the migration ran. */
export async function fetchBodyMeasurementsSince(
  userId: string,
  sinceKey: string,
): Promise<BodyMeasurementRow[]> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select(VALUES_SELECT)
    .eq('user_id', userId)
    .gte('measured_on', sinceKey)
    .order('measured_on', { ascending: true });

  if (error) {
    if (isMissingSchemaError(error)) {
      return [];
    }
    throw error;
  }
  return ((data ?? []) as Row[]).map(mapRow);
}

/**
 * One row per day. All values empty removes that day's row, so clearing the
 * sheet clears the day.
 */
export async function saveBodyMeasurement(params: {
  userId: string;
  measuredOn: string;
  values: BodyMeasurementValues;
}): Promise<void> {
  const { chest_cm, arm_cm, hip_cm, thigh_cm } = params.values;
  const isEmpty = chest_cm == null && arm_cm == null && hip_cm == null && thigh_cm == null;

  if (isEmpty) {
    const { error } = await supabase
      .from('body_measurements')
      .delete()
      .eq('user_id', params.userId)
      .eq('measured_on', params.measuredOn);
    if (error) {
      throw error;
    }
    return;
  }

  const payload = { chest_cm, arm_cm, hip_cm, thigh_cm, updated_at: new Date().toISOString() };
  const { data: updatedRows, error: updateError } = await supabase
    .from('body_measurements')
    .update(payload)
    .eq('user_id', params.userId)
    .eq('measured_on', params.measuredOn)
    .select('id');

  if (updateError) {
    throw updateError;
  }
  if (updatedRows?.length) {
    return;
  }

  const { error: insertError } = await supabase.from('body_measurements').insert({
    user_id: params.userId,
    measured_on: params.measuredOn,
    ...payload,
  });
  if (insertError) {
    throw insertError;
  }
}

export type BuildUpBodyData = {
  weightKg: DatedValue[];
  waistCm: DatedValue[];
  chestCm: DatedValue[];
  armCm: DatedValue[];
  /** measured_on of every body_measurements row since `sinceKey`. */
  measuredOn: string[];
};

/** Weight, waist and measurements on or after `sinceKey` for the build-up card. */
export async function fetchBuildUpBodyData(
  userId: string,
  sinceKey: string,
): Promise<BuildUpBodyData> {
  const [weightResult, waistResult, measurements] = await Promise.all([
    supabase
      .from('weight_logs')
      .select('weight_kg, logged_on')
      .eq('user_id', userId)
      .gte('logged_on', sinceKey)
      .order('logged_on', { ascending: true }),
    supabase
      .from('waist_logs')
      .select('waist_cm, logged_on')
      .eq('user_id', userId)
      .gte('logged_on', sinceKey)
      .order('logged_on', { ascending: true }),
    fetchBodyMeasurementsSince(userId, sinceKey),
  ]);

  if (weightResult.error) {
    throw weightResult.error;
  }
  if (waistResult.error) {
    throw waistResult.error;
  }

  const dated = <T>(
    rows: readonly T[],
    on: (row: T) => string | null | undefined,
    value: (row: T) => number | null,
  ): DatedValue[] =>
    rows.flatMap((row) => {
      const day = on(row);
      const v = value(row);
      return day != null && v != null ? [{ on: day, value: v }] : [];
    });

  return {
    weightKg: dated(
      (weightResult.data ?? []) as { weight_kg: number | string; logged_on: string | null }[],
      (row) => row.logged_on,
      (row) => positiveNumber(row.weight_kg),
    ),
    waistCm: dated(
      (waistResult.data ?? []) as { waist_cm: number | string; logged_on: string }[],
      (row) => row.logged_on,
      (row) => positiveNumber(row.waist_cm),
    ),
    chestCm: dated(measurements, (row) => row.measured_on, (row) => row.chest_cm),
    armCm: dated(measurements, (row) => row.measured_on, (row) => row.arm_cm),
    measuredOn: measurements.map((row) => row.measured_on),
  };
}
