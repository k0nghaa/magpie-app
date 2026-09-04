const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-audio-api 0.13.3의 AudioControls UI 위젯이 미선언 peer 의존성
// (react-native-gesture-handler / react-native-reanimated)를 import한다.
// 앱은 이 위젯을 쓰지 않지만 배럴 export(index → api → AudioControls) 때문에
// 번들 그래프에 딸려 들어와 번들링이 깨진다.
// 라이브러리 내부에서 들어오는 두 import만 빈 스텁으로 치환해 그래프에서 제거한다.
// (둘 다 네이티브 모듈 → 정식 설치 시 EAS 재빌드가 필요하지만, 안 쓰는 위젯이라 스텁으로 충분)
const emptyStub = require.resolve('./stubs/empty.js');
const STUBBED = new Set([
  'react-native-gesture-handler',
  'react-native-reanimated',
]);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    STUBBED.has(moduleName) &&
    context.originModulePath.includes('react-native-audio-api')
  ) {
    return { type: 'sourceFile', filePath: emptyStub };
  }
  const resolver = defaultResolveRequest || context.resolveRequest;
  return resolver(context, moduleName, platform);
};

module.exports = config;
