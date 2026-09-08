import { Href, Redirect } from 'expo-router';

/** @deprecated Combined into /koli/macro-goals */
export default function ProteinGoalRedirect() {
  return <Redirect href={'/koli/macro-goals' as Href} />;
}
