package com.newmeet.app.newmeet_mobile

import android.content.Intent
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.newmeet.app.newmeet_mobile/screen_capture"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "startScreenCaptureService" -> {
                    startScreenCaptureService()
                    result.success("Service started")
                }
                "stopScreenCaptureService" -> {
                    stopScreenCaptureService()
                    result.success("Service stopped")
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }

    private fun startScreenCaptureService() {
        val intent = Intent(this, ScreenCaptureService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopScreenCaptureService() {
        val intent = Intent(this, ScreenCaptureService::class.java)
        stopService(intent)
    }
}