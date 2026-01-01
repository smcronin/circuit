import { Redirect } from 'expo-router';

export default function Index() {
  // Always redirect to onboarding for now
  return <Redirect href="/onboarding" />;
}
