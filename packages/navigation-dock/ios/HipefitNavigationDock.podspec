Pod::Spec.new do |s|
  s.name           = 'HipefitNavigationDock'
  s.version        = '1.0.0'
  s.summary        = 'Native navigation dock for Hipefit.'
  s.description    = 'iOS-only Expo view module that renders the Hipefit create action panel and its scrim.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  # Matches `ios.deploymentTarget` in apps/mobile/ios/Podfile.properties.json. The iOS 26
  # glass material is reached through availability checks, not a raised floor.
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
