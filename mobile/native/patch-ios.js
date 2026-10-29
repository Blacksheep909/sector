// After `npx cap add ios` (on a Mac): landscape only, no status bar, and plain http to servers on the local network
// (Sector.exe on your Wi-Fi), with the local-network permission prompt iOS requires. Safe to run more than once.
const fs = require('fs'), path = require('path');
const plist = path.join(__dirname, '..', 'ios', 'App', 'App', 'Info.plist');
let p = fs.readFileSync(plist, 'utf8');
const set = (key, xml) => {
  const re = new RegExp(`<key>${key}</key>\\s*(<array>[\\s\\S]*?</array>|<dict>[\\s\\S]*?</dict>|<string>[\\s\\S]*?</string>|<true/>|<false/>)`);
  p = re.test(p) ? p.replace(re, `<key>${key}</key>\n\t${xml}`) : p.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t${xml}\n</dict>\n</plist>\n`);
};
const land = '<array>\n\t\t<string>UIInterfaceOrientationLandscapeLeft</string>\n\t\t<string>UIInterfaceOrientationLandscapeRight</string>\n\t</array>';
set('UISupportedInterfaceOrientations', land);
set('UISupportedInterfaceOrientations~ipad', land);
set('UIStatusBarHidden', '<true/>');
set('UIViewControllerBasedStatusBarAppearance', '<false/>');
set('UIRequiresFullScreen', '<true/>');
set('NSAppTransportSecurity', '<dict>\n\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<true/>\n\t\t<key>NSAllowsArbitraryLoadsInWebContent</key>\n\t\t<true/>\n\t</dict>');
set('NSLocalNetworkUsageDescription', '<string>SECTOR connects to game servers on your Wi-Fi, like a PC running Sector.exe.</string>');
fs.writeFileSync(plist, p);
console.log('ios patched: landscape, no status bar, local network');
