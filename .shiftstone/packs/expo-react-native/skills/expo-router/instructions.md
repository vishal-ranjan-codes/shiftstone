# Expo Router Navigation Skill

> Load this skill when designing mobile screens, configuring layout navigators (Stack, Tabs), setting up deep linking, or pushing routes.

---

## 1. Directory Structure & Layouts (`app/`)

Expo Router maps files inside the `app/` directory to screens:

- `app/_layout.tsx`: Root layout defining navigation structure.
- `app/index.tsx`: Initial screen route (`/`).
- `app/[id].tsx`: Dynamic route matching parameter `id`.
- `app/(tabs)/_layout.tsx`: Tab-based navigation group.

Example Root Stack Layout (`app/_layout.tsx`):
```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#101828' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="details/[id]" options={{ title: 'Details' }} />
    </Stack>
  );
}
```

---

## 2. Navigating and Linking

Use the `<Link>` component for declarative links or `useRouter` for programmatic navigation:

```tsx
import { Link, useRouter } from 'expo-router';
import { View, Text, Button } from 'react-native';

export function NavigationDemo() {
  const router = useRouter();

  return (
    <View>
      <Link href="/details/item-42">
        <Text>Go to Item 42</Text>
      </Link>

      <Button
        title="Open Settings"
        onPress={() => router.push('/settings')}
      />
    </View>
  );
}
```

---

## 3. Dynamic Route Parameters

Read URL parameters in screens using `useLocalSearchParams`:

```tsx
// app/details/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { View, Text } from 'react-native';

export default function DetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View>
      <Text>Showing details for ID: {id}</Text>
    </View>
  );
}
```
