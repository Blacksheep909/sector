// After `npx cap add android`: landscape only, full screen (immersive: no status or navigation bar), plain http allowed
// (a SECTOR server on your Wi-Fi isn't https), and the app's colours. Safe to run more than once.
const fs = require('fs'), path = require('path');
const app = path.join(__dirname, '..', 'android', 'app', 'src', 'main');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'capacitor.config.json'), 'utf8'));

// 1. the manifest: landscape (either way up), cleartext traffic
const mf = path.join(app, 'AndroidManifest.xml');
let m = fs.readFileSync(mf, 'utf8');
if (!m.includes('android:screenOrientation')) m = m.replace(/<activity\b/, '<activity\n            android:screenOrientation="sensorLandscape"');
if (!m.includes('usesCleartextTraffic')) m = m.replace(/<application\b/, '<application\n        android:usesCleartextTraffic="true"');
fs.writeFileSync(mf, m);

// 2. the activity: immersive full screen, and it stays that way after the keyboard or a notification shade
const pkg = cfg.appId.split('.');
const act = path.join(app, 'java', ...pkg, 'MainActivity.java');
fs.writeFileSync(act, `package ${cfg.appId};

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);   // a long turn shouldn't dim the screen
        immersive();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    private void immersive() {
        View decor = getWindow().getDecorView();
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), decor);
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
`);
console.log('android patched: landscape, immersive, cleartext');
