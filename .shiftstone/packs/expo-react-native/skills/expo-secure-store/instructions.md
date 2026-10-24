# Expo SecureStore Token Storage Skill

> Load this skill when storing authentication credentials, access tokens, encryption keys, or private user identifiers on mobile devices.

---

## 1. SecureStore API Operations

Store sensitive data using hardware-backed encryption (iOS Keychain / Android Keystore):

```ts
import * as SecureStore from 'expo-secure-store';

export async function saveSecureToken(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

export async function getSecureToken(key: string): Promise<string | null> {
  return await SecureStore.getItemAsync(key);
}

export async function deleteSecureToken(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
```

---

## 2. Auth Session Storage Adapter Pattern

Implement an auth storage adapter for Supabase, Firebase, or custom OAuth clients:

```ts
// lib/auth-storage.ts
import * as SecureStore from 'expo-secure-store';

export const MobileAuthStorage = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};
```

---

## 3. Security Best Practices

- Never store sensitive secrets (passwords, JWT refresh tokens) in unencrypted `AsyncStorage`.
- Keys must only contain alphanumeric characters, `.`, `-`, and `_`.
- Check if SecureStore is available using `SecureStore.isAvailableAsync()` on web platforms.
