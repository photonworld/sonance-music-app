package com.soulwave.music;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;
import com.soulwave.music.R;

public class SonanceWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_PLAY_PAUSE = "com.soulwave.music.widget.ACTION_PLAY_PAUSE";
    public static final String ACTION_NEXT = "com.soulwave.music.widget.ACTION_NEXT";
    public static final String ACTION_PREV = "com.soulwave.music.widget.ACTION_PREV";
    public static final String EXTRA_WIDGET_ACTION = "sonance_widget_action";

    private static final String PREFS_NAME = "CapacitorStorage";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (action == null) return;

        if (ACTION_PLAY_PAUSE.equals(action) || ACTION_NEXT.equals(action) || ACTION_PREV.equals(action)) {
            String mapped = ACTION_PLAY_PAUSE.equals(action)
                    ? "play_pause"
                    : ACTION_NEXT.equals(action) ? "next" : "prev";

            // Broadcast internally if app is alive, and launch/foreground MainActivity with action extra
            Intent bridgeIntent = new Intent("com.soulwave.music.INTERNAL_WIDGET_ACTION");
            bridgeIntent.setPackage(context.getPackageName());
            bridgeIntent.putExtra(EXTRA_WIDGET_ACTION, mapped);
            context.sendBroadcast(bridgeIntent);

            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launchIntent.putExtra(EXTRA_WIDGET_ACTION, mapped);
            context.startActivity(launchIntent);
        } else if (AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
            updateAllWidgets(context);
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName widget = new ComponentName(context, SonanceWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(widget);
        for (int id : ids) {
            updateAppWidget(context, manager, id);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String title = prefs.getString("sonance_widget_title", "Soulwave");
        String artist = prefs.getString("sonance_widget_artist", "Tap to play music");
        boolean isPlaying = "true".equals(prefs.getString("sonance_widget_playing", "false"));
        String accentHex = prefs.getString("sonance_widget_accent", "#D94E28");
        String textHex = prefs.getString("sonance_widget_text", "#F3F4F6");
        String mutedHex = prefs.getString("sonance_widget_muted", "#989EA8");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sonance_widget);
        views.setTextViewText(R.id.widget_title, title);
        views.setTextViewText(R.id.widget_artist, artist);

        try {
            views.setTextColor(R.id.widget_title, Color.parseColor(textHex));
            views.setTextColor(R.id.widget_artist, Color.parseColor(mutedHex));
            views.setInt(R.id.widget_art_icon, "setColorFilter", Color.parseColor(accentHex));
        } catch (IllegalArgumentException ignored) {
            // Fallback to default XML colors if hex string is malformed
        }

        views.setImageViewResource(
                R.id.widget_btn_play,
                isPlaying ? R.drawable.ic_widget_pause : R.drawable.ic_widget_play
        );

        // Launch Soulwave when tapping album art / track info
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent launchPending = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_launch_area, launchPending);

        // Transport button PendingIntents
        views.setOnClickPendingIntent(
                R.id.widget_btn_prev,
                createActionPendingIntent(context, ACTION_PREV, 101)
        );
        views.setOnClickPendingIntent(
                R.id.widget_btn_play,
                createActionPendingIntent(context, ACTION_PLAY_PAUSE, 102)
        );
        views.setOnClickPendingIntent(
                R.id.widget_btn_next,
                createActionPendingIntent(context, ACTION_NEXT, 103)
        );

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static PendingIntent createActionPendingIntent(
            Context context,
            String action,
            int requestCode
    ) {
        Intent intent = new Intent(context, SonanceWidgetProvider.class);
        intent.setAction(action);
        return PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
