Pod::Spec.new do |s|
  s.name           = 'InstagramStories'
  s.version        = '1.0.0'
  s.summary        = 'Kolibi: share a sticker or story card to Instagram Stories.'
  s.description    = 'Local Expo module: puts typed Instagram Stories items on the pasteboard (with expiry) and opens instagram-stories://share.'
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
