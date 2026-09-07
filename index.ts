import { registerRootComponent } from 'expo';

import App from './App';
import { configureNotifications } from './src/notifications/handler';

// 앱 렌더 이전에 알림 표시 핸들러를 등록(포그라운드 알림 배너 표시).
configureNotifications();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
