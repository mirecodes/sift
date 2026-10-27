package com.mirecodes.sift;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Sift's own app-local plugins (Capacitor discovers npm plugins only).
        registerPlugin(LiveProgressPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
