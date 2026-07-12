const { withPodfile } = require('expo/config-plugins');

function withIosModularHeaders(config) {
  return withPodfile(config, (podfileConfig) => {
    const modularPods = `
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true`;

    if (!podfileConfig.modResults.contents.includes("pod 'GoogleUtilities', :modular_headers => true")) {
      podfileConfig.modResults.contents = podfileConfig.modResults.contents.replace(
        /use_expo_modules!/,
        `use_expo_modules!${modularPods}`,
      );
    }

    return podfileConfig;
  });
}

module.exports = withIosModularHeaders;
