# React Native Testing with Jest & RNTL Skill

> Load this skill when writing unit tests for React Native components, mocking Expo modules, or configuring Jest with the jest-expo preset.

---

## 1. Jest Configuration (`package.json`)

Configure Jest using the `jest-expo` preset:

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ]
  }
}
```

---

## 2. Component Testing with `@testing-library/react-native`

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../app/index';

describe('<HomeScreen />', () => {
  it('renders title and responds to press events', () => {
    render(<HomeScreen />);

    const titleElement = screen.getByText(/Starter/i);
    expect(titleElement).toBeTruthy();
  });
});
```

---

## 3. Mocking Native Modules

Mock Expo APIs (such as SecureStore or Notifications) cleanly in `jest.setup.js`:

```ts
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve('mock-token')),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: '123' }),
}));
```
