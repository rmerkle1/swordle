import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 to reach the host machine's localhost.
// iOS simulator and web can use localhost directly.
const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_BASE = `http://${DEFAULT_HOST}:3000/api`;
