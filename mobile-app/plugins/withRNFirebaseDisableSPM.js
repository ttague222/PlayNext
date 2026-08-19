/**
 * Expo config plugin: force @react-native-firebase onto the classic CocoaPods
 * path instead of SPM.
 *
 * RNFirebase v22+ resolves firebase-ios-sdk via Swift Package Manager by
 * default, which is incompatible with `use_frameworks! :linkage => :static`
 * (the pod hard-fails with "SPM + static linkage is not supported").
 * Setting $RNFirebaseDisableSPM opts out of SPM, and
 * $RNFirebaseAsStaticFramework is required on the classic path with static
 * frameworks.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const GLOBALS = '$RNFirebaseDisableSPM = true\n$RNFirebaseAsStaticFramework = true\n';

module.exports = function withRNFirebaseDisableSPM(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes('$RNFirebaseDisableSPM')) {
        fs.writeFileSync(podfilePath, GLOBALS + contents);
      }
      return config;
    },
  ]);
};
