/**
 * expo-react-native scaffold (task 7.5 placeholder) — creates the app
 * skeleton. Replace the body with a starter clone when the pack graduates
 * from placeholder status.
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
    'App.tsx': `import { StatusBar } from 'expo-status-bar';\nimport { Text, View } from 'react-native';\n\nexport default function App() {\n  return (\n    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>\n      <Text>{{PROJECT_NAME}}</Text>\n      <StatusBar style="auto" />\n    </View>\n  );\n}\n`,
    'app.json': `{\n  "name": "{{PROJECT_NAME_LOWER}}",\n  "slug": "{{PROJECT_NAME_LOWER}}",\n  "version": "0.1.0",\n  "orientation": "portrait",\n  "userInterfaceStyle": "automatic",\n  "platforms": ["ios", "android"]\n}\n`,
    'package.json': `{\n  "name": "{{PROJECT_NAME_LOWER}}",\n  "version": "0.1.0",\n  "private": true,\n  "main": "node_modules/expo/AppEntry.js",\n  "scripts": {\n    "start": "expo start",\n    "android": "expo start --android",\n    "ios": "expo start --ios",\n    "test": "jest"\n  },\n  "dependencies": {\n    "expo": "~52",\n    "expo-status-bar": "~2",\n    "react": "19.0.0",\n    "react-native": "0.76"\n  }\n}\n`,
    'README.md': '# {{PROJECT_NAME}}\n\nExpo + React Native starter.\n\n```bash\npnpm install\npnpm start\n```\n',
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
