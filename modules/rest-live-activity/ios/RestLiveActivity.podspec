Pod::Spec.new do |s|
  s.name           = 'RestLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Kolibi rest timer Live Activity (ActivityKit start/update/end).'
  s.description    = 'Local Expo module: starts, updates and ends the rest timer Live Activity that the Kolibi widget extension renders.'
  s.author         = 'Kolibi'
  s.homepage       = 'https://github.com/expo/expo'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
