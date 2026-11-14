package com.ankit.sonance;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private BroadcastReceiver widgetActionReceiver;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SonanceWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        handleWidgetIntent(getIntent());

        widgetActionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                handleWidgetIntent(intent);
            }
        };

        IntentFilter filter = new IntentFilter("com.ankit.sonance.INTERNAL_WIDGET_ACTION");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(widgetActionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(widgetActionReceiver, filter);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleWidgetIntent(intent);
    }

    @Override
    public void onDestroy() {
        if (widgetActionReceiver != null) {
            unregisterReceiver(widgetActionReceiver);
            widgetActionReceiver = null;
        }
        super.onDestroy();
    }

    private void handleWidgetIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra(SonanceWidgetProvider.EXTRA_WIDGET_ACTION);
        if (action == null || action.isEmpty()) return;

        intent.removeExtra(SonanceWidgetProvider.EXTRA_WIDGET_ACTION);
        if (getBridge() != null) {
            String js = "window.dispatchEvent(new CustomEvent('sonance-widget-action', { detail: { action: '"
                    + action.replace("'", "")
                    + "' } }));";
            getBridge().eval(js, null);
        }
    }
}
