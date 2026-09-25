import { createMMKV } from 'react-native-mmkv';

import type { StringKvStorage } from '@/lib/workouts/kv-storage';

/** Same MMKV instance as the check-in "Heute nicht" day. */
export const recommendationStorage: StringKvStorage = createMMKV({ id: 'app-settings' });
