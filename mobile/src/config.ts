import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Physical devices need the host machine's LAN IP.
// Expo provides this via the debuggerHost manifest field.
// Falls back to emulator-specific addresses or localhost.
function getHost(): string {
  const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    return debuggerHost.split(':')[0];
  }
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

export const API_BASE = `http://${getHost()}:3000/api`;
