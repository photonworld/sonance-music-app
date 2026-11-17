package com.soulwave.music;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SonanceWidget")
public class SonanceWidgetPlugin extends Plugin {

    @PluginMethod
    public void notifyUpdate(PluginCall call) {
        SonanceWidgetProvider.updateAllWidgets(getContext());
        call.resolve();
    }
}
