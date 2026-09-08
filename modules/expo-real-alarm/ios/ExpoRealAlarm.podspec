Pod::Spec.new do |s|
  s.name           = 'ExpoRealAlarm'
  s.version        = '1.0.0'
  s.summary        = 'iOS 26 AlarmKit 진짜 알람 (매그파이 M2.5 스파이크)'
  s.description    = 'AlarmKit로 무음/DND를 뚫는 알람을 예약하고, 알람 버튼으로 앱을 실행하는 커스텀 Expo 네이티브 모듈.'
  s.author         = ''
  s.homepage       = 'https://github.com/k0nghaa/magpie'
  s.license        = { type: 'MIT' }
  # AlarmKit 자체는 iOS 26+에서만 동작하지만, 코드가 전부 @available(iOS 26.0, *)로
  # 런타임 게이팅되므로 pod 최소 타깃은 앱 기본값(SDK 57)에 맞춘다. (미만 기기는 fallback 경로)
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
