package com.newmeet.app.newmeet_mobile

import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.util.Rational
import androidx.annotation.RequiresApi
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.Result

class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.newmeet.app.newmeet_mobile/screen_capture"
    private val PIP_CHANNEL = "com.academiqmeet.pip"
    private val SCREEN_RECORDING_CHANNEL = "com.newmeet.screen_recording"
    private var pipMethodChannel: MethodChannel? = null
    private var recordingResult: Result? = null
    private val REQUEST_MEDIA_PROJECTION = 1000

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        // Screen capture channel
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
        
        // PiP channel
        pipMethodChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, PIP_CHANNEL)
        pipMethodChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "isPipSupported" -> {
                    result.success(isPipSupported())
                }
                "enterPipMode" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        result.success(enterPipMode())
                    } else {
                        result.success(false)
                    }
                }
                "exitPipMode" -> {
                    result.success(exitPipMode())
                }
                "isInPipMode" -> {
                    result.success(isInPipMode())
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
        
        // Screen recording channel
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, SCREEN_RECORDING_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "startRecording" -> {
                    val filePath = call.argument<String>("filePath")
                    val audio = call.argument<Boolean>("audio") ?: true
                    startScreenRecording(filePath, audio, result)
                }
                "stopRecording" -> {
                    stopScreenRecording(result)
                }
                "pauseRecording" -> {
                    pauseScreenRecording(result)
                }
                "resumeRecording" -> {
                    resumeScreenRecording(result)
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

    // PiP support check
    private fun isPipSupported(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
        } else {
            false
        }
    }

    // Enter PiP mode
    @RequiresApi(Build.VERSION_CODES.N)
    private fun enterPipMode(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Android 8.0+ uses PictureInPictureParams
                val aspectRatio = Rational(16, 9) // Standard video aspect ratio
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(aspectRatio)
                    .build()
                enterPictureInPictureMode(params)
            } else {
                // Android 7.0-7.1 uses the older API
                enterPictureInPictureMode()
            }
            true
        } catch (e: IllegalStateException) {
            // Activity must be resumed to enter picture-in-picture
            // This can happen if the activity is paused or not in the foreground
            android.util.Log.w("MainActivity", "Cannot enter PiP mode: Activity must be resumed. ${e.message}")
            false
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Error entering PiP mode: ${e.message}")
            e.printStackTrace()
            false
        }
    }

    // Exit PiP mode (move to foreground)
    private fun exitPipMode(): Boolean {
        return try {
            // Move task to front to exit PiP
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(intent)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    // Check if currently in PiP mode
    private fun isInPipMode(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            isInPictureInPictureMode
        } else {
            false
        }
    }

    // Handle PiP mode changes
    @RequiresApi(Build.VERSION_CODES.N)
    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode)
        // Notify Flutter about PiP state change
        pipMethodChannel?.invokeMethod("onPipModeChanged", isInPictureInPictureMode)
    }
    
    // Screen recording methods
    private var pendingRecordingPath: String? = null
    private var pendingAudio: Boolean = true
    
    private fun startScreenRecording(filePath: String?, audio: Boolean, result: Result) {
        try {
            recordingResult = result
            pendingRecordingPath = filePath
            pendingAudio = audio
            // Request MediaProjection permission
            val mediaProjectionManager = getSystemService(MediaProjectionManager::class.java)
            val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
            startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION)
        } catch (e: Exception) {
            e.printStackTrace()
            result.error("RECORDING_ERROR", "Failed to start recording: ${e.message}", null)
            recordingResult = null
            pendingRecordingPath = null
        }
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == RESULT_OK && data != null) {
                // Start the recording service with MediaProjection result
                // Store the result code and data in a way the service can access
                val intent = Intent(this, ScreenRecordingService::class.java).apply {
                    putExtra("resultCode", resultCode)
                    // Pass data as parcelable
                    putExtra("data", data)
                    putExtra("filePath", pendingRecordingPath)
                    putExtra("audio", pendingAudio)
                    action = "START_RECORDING"
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(intent)
                } else {
                    startService(intent)
                }
                recordingResult?.success(true)
            } else {
                recordingResult?.error("PERMISSION_DENIED", "Screen recording permission denied", null)
            }
            recordingResult = null
            pendingRecordingPath = null
        }
    }
    
    private fun stopScreenRecording(result: Result) {
        try {
            val intent = Intent(this, ScreenRecordingService::class.java).apply {
                action = "STOP_RECORDING"
            }
            startService(intent)
            
            // Wait a bit for the service to process the stop command
            // The service is asynchronous, so we need to poll for the result
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                val path = ScreenRecordingService.getLastRecordingPath()
                if (path != null) {
                    result.success(path)
                } else {
                    // Try again after a longer delay
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        val finalPath = ScreenRecordingService.getLastRecordingPath()
                        result.success(finalPath)
                    }, 500)
                }
            }, 200)
        } catch (e: Exception) {
            e.printStackTrace()
            result.error("RECORDING_ERROR", "Failed to stop recording: ${e.message}", null)
        }
    }
    
    private fun pauseScreenRecording(result: Result) {
        try {
            val intent = Intent(this, ScreenRecordingService::class.java).apply {
                action = "PAUSE_RECORDING"
            }
            startService(intent)
            result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            result.error("RECORDING_ERROR", "Failed to pause recording: ${e.message}", null)
        }
    }
    
    private fun resumeScreenRecording(result: Result) {
        try {
            val intent = Intent(this, ScreenRecordingService::class.java).apply {
                action = "RESUME_RECORDING"
            }
            startService(intent)
            result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            result.error("RECORDING_ERROR", "Failed to resume recording: ${e.message}", null)
        }
    }
}