/**
 * expo-react-native scaffold (graduated to LOCK-B4 bar).
 * Generates an Expo Router project with health test using Jest.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function run(context) {
  const { root, composition, archetype, answers } = context;
  const composed = composition.archetypes.find((a) => a.name === archetype.name) ?? archetype;
  const appPath = composed.effectiveAppPath ?? composed.manifest.spec.defaultAppPath;
  const targetDir = path.join(root, appPath);
  const created = [];
  const projectName = answers?.projectName ?? 'MySaaSApp';
  const projectNameLower = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    created.push(appPath);
  }
  const files = {
    'package.json': `${JSON.stringify(
      {
        name: `${projectNameLower}-mobile`,
        version: '0.1.0',
        private: true,
        main: 'expo-router/entry',
        scripts: {
          dev: 'expo start',
          build: 'expo export',
          test: 'jest',
          lint: 'eslint .',
          typecheck: 'tsc --noEmit',
        },
        dependencies: {
          expo: '~52.0.0',
          'expo-constants': '~17.0.0',
          'expo-linking': '~7.0.0',
          'expo-router': '~4.0.0',
          'expo-status-bar': '~2.0.0',
          react: '18.3.1',
          'react-native': '0.76.2',
        },
        devDependencies: {
          '@types/react': '~18.3.12',
          jest: '^29.2.1',
          'jest-expo': '~52.0.0',
          typescript: '^5.3.3',
        },
        jest: {
          preset: 'jest-expo',
        },
      },
      null,
      2,
    )}\n`,
    'app.json': `${JSON.stringify(
      {
        expo: {
          name: projectName,
          slug: projectNameLower,
          version: '0.1.0',
          orientation: 'portrait',
          userInterfaceStyle: 'automatic',
          scheme: projectNameLower,
          plugins: ['expo-router'],
          platforms: ['ios', 'android'],
        },
      },
      null,
      2,
    )}\n`,
    'app/_layout.tsx': `import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
    </Stack>
  );
}
`,
    'app/index.tsx': `import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{{PROJECT_NAME}}</Text>
      <Text>Expo + React Native Starter</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});
`,
    'app/health.ts': `export function getAppHealth() {
  return { status: 'ok', timestamp: Date.now() };
}
`,
    'app/__tests__/health.test.tsx': `import { getAppHealth } from '../health';

describe('health check', () => {
  it('returns status ok', () => {
    const health = getAppHealth();
    expect(health.status).toBe('ok');
    expect(typeof health.timestamp).toBe('number');
  });
});
`,
    'README.md': `# {{PROJECT_NAME}} (Expo Mobile App)

\`\`\`bash
pnpm dev
\`\`\`

Run tests:

\`\`\`bash
pnpm test
\`\`\`
`,
  };

  for (const [name, content] of Object.entries(files)) {
    const file = path.join(targetDir, name);
    if (existsSync(file)) continue;
    mkdirSync(path.dirname(file), { recursive: true });
    const resolved = content
      .split('{{PROJECT_NAME_LOWER}}').join(projectNameLower)
      .split('{{PROJECT_NAME}}').join(projectName);
    writeFileSync(file, resolved, 'utf8');
    created.push(path.join(appPath, name));
  }
  if (created.length > 0) console.log(`   📱 expo scaffold created: ${created.join(', ')}`);
  return { created };
}
