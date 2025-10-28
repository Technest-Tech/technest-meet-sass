package com.newmeet.app.newmeet_mobile

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleObserver
import androidx.lifecycle.OnLifecycleEvent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity: FlutterActivity(), LifecycleObserver {
    private val CHANNEL = "com.newmeet.app.newmeet_mobile/screen_capture"
    private val CALL_CHANNEL = "com.newmeet.app.newmeet_mobile/call_service"
    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Add lifecycle observer
        lifecycle.addObserver(this)
        
        // Initialize audio manager for maintaining audio focus
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        
        // Set audio mode for communication
        audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
        
        // Request audio focus
        requestAudioFocus()
        
        // Acquire wake lock to prevent audio from being paused
        // Note: Wake lock is acquired indefinitely to keep audio alive
        // It will be released when the app is destroyed
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "AlmajdMeet::AudioWakeLock"
        )
        @Suppress("WakelockTimeout")
        wakeLock?.acquire()
        android.util.Log.d("MainActivity", "Wake lock acquired for audio (indefinite)")
    }
    
    @OnLifecycleEvent(Lifecycle.Event.ON_PAUSE)
    fun onAppPaused() {
        android.util.Log.d("MainActivity", "App paused - maintaining audio for background operation")
        
        // CRITICAL: Keep audio mode in communication even when paused
        audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
        
        // Ensure microphone stays unmuted in background
        audioManager?.isMicrophoneMute = false
        
        // Re-request audio focus to ensure it's maintained
        requestAudioFocus()
        
        android.util.Log.d("MainActivity", "Background audio maintained - Mode: ${audioManager?.mode}, MicMute: ${audioManager?.isMicrophoneMute}")
    }
    
    @OnLifecycleEvent(Lifecycle.Event.ON_RESUME)
    fun onAppResumed() {
        android.util.Log.d("MainActivity", "App resumed - ensuring audio mode")
        
        // Ensure audio mode is still in communication
        audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
        
        // Ensure microphone is not muted
        audioManager?.isMicrophoneMute = false
        
        // Re-request audio focus in case it was lost
        requestAudioFocus()
        
        android.util.Log.d("MainActivity", "Foreground audio ensured - Mode: ${audioManager?.mode}, MicMute: ${audioManager?.isMicrophoneMute}")
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        // Screen capture service channel
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
        
        // Call service channel for maintaining mic in background
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CALL_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "startCallService" -> {
                    startCallService()
                    result.success("Call service started")
                }
                "stopCallService" -> {
                    stopCallService()
                    result.success("Call service stopped")
                }
                "configureAudioForBackground" -> {
                    configureAudioForBackground()
                    result.success("Audio configured")
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }
    
    private fun configureAudioForBackground() {
        try {
            // Force audio to stay active for background operation
            // MODE_IN_COMMUNICATION is specifically designed for VoIP apps
            audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
            
            // CRITICAL: Ensure microphone is NOT muted
            audioManager?.isMicrophoneMute = false
            
            // Don't force speakerphone - let user control this
            // audioManager?.isSpeakerphoneOn = false
            
            // Set audio stream volume to ensure it's not silent
            val currentVolume = audioManager?.getStreamVolume(AudioManager.STREAM_VOICE_CALL) ?: 0
            if (currentVolume == 0) {
                audioManager?.setStreamVolume(
                    AudioManager.STREAM_VOICE_CALL,
                    audioManager?.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL)?.div(2) ?: 5,
                    0
                )
            }
            
            android.util.Log.d("MainActivity", "Audio configured for background - Mode: ${audioManager?.mode}, MicMute: ${audioManager?.isMicrophoneMute}, Volume: $currentVolume")
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Error configuring audio: ${e.message}")
        }
    }

    private fun requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()

            audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(audioAttributes)
                .setAcceptsDelayedFocusGain(true)
                .setWillPauseWhenDucked(false)
                .setOnAudioFocusChangeListener { focusChange ->
                    // Handle audio focus changes
                    android.util.Log.d("MainActivity", "Audio focus changed: $focusChange")
                    
                    when (focusChange) {
                        AudioManager.AUDIOFOCUS_LOSS, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                            // Try to regain focus immediately for VoIP calls
                            android.util.Log.w("MainActivity", "Lost audio focus - attempting to regain")
                            audioManager?.requestAudioFocus(audioFocusRequest!!)
                            
                            // Ensure mic stays unmuted
                            audioManager?.isMicrophoneMute = false
                        }
                        AudioManager.AUDIOFOCUS_GAIN -> {
                            android.util.Log.d("MainActivity", "Gained audio focus - ensuring mic active")
                            // Ensure mode stays in communication
                            audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
                            audioManager?.isMicrophoneMute = false
                        }
                    }
                }
                .build()

            val result = audioManager?.requestAudioFocus(audioFocusRequest!!)
            android.util.Log.d("MainActivity", "Audio focus request result: $result")
        } else {
            @Suppress("DEPRECATION")
            val result = audioManager?.requestAudioFocus(
                null,
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN
            )
            android.util.Log.d("MainActivity", "Audio focus request result (legacy): $result")
        }
        
        // Always ensure mic is not muted after requesting focus
        audioManager?.isMicrophoneMute = false
    }

    private fun abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let {
                audioManager?.abandonAudioFocusRequest(it)
            }
        } else {
            @Suppress("DEPRECATION")
            audioManager?.abandonAudioFocus(null)
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

    private fun startCallService() {
        val intent = Intent(this, CallService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopCallService() {
        val intent = Intent(this, CallService::class.java)
        stopService(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        
        // Release wake lock
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                android.util.Log.d("MainActivity", "Wake lock released")
            }
        }
        
        // Stop call service when app is destroyed
        stopCallService()
        
        // Abandon audio focus
        abandonAudioFocus()
        
        // Reset audio mode to normal
        audioManager?.mode = AudioManager.MODE_NORMAL
    }
}