package com.mirecodes.sift;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lock-screen progress (guidance_v2 Step 6.8, ADR-049): one silent ongoing notification with a system
 * chronometer counting down to the planned end, so it stays right while the app is suspended. Past the end
 * of Focus the chronometer keeps going below zero (overtime). A break's notification removes itself at the
 * break end. Passive: no actions; a tap opens the app.
 */
@CapacitorPlugin(name = "SiftLiveProgress")
public class LiveProgressPlugin extends Plugin {

    private static final String CHANNEL = "live_progress";
    private static final int ID = 4100;

    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        String phase = call.getString("phase", "focus");
        Double endsAt = call.getDouble("endsAt");
        if (endsAt == null) {
            call.reject("endsAt is required");
            return;
        }
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        if (!manager.areNotificationsEnabled()) {
            call.resolve();
            return;
        }
        ensureChannel(context);
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        PendingIntent tap = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        long end = endsAt.longValue();
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_sift)
            .setContentTitle(call.getString("title", ""))
            .setContentText(call.getString("detail", ""))
            .setOngoing(true)
            .setSilent(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setWhen(end)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(tap);
        if ("break".equals(phase)) builder.setTimeoutAfter(Math.max(1, end - System.currentTimeMillis()));
        try {
            manager.notify(ID, builder.build());
        } catch (SecurityException e) {
            // Notifications permission revoked between the check and the post.
        }
        call.resolve();
    }

    @PluginMethod
    public void end(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(ID);
        call.resolve();
    }

    private void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Focus progress", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("The running focus or break timer");
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);
    }
}
