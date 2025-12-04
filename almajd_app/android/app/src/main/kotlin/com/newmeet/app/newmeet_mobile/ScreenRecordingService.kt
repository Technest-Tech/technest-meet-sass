package com.newmeet.app.newmeet_mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.IBinder
import android.provider.MediaStore
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.OutputStream

class ScreenRecordingService : Service() {
    companion object {
        const val NOTIFICATION_ID = 1002
        const val CHANNEL_ID = "screen_recording_channel"
        private var lastRecordingPath: String? = null
        private var isRecordingState = false
        private val pathLock = Any()
        
        fun getLastRecordingPath(): String? = synchronized(pathLock) { lastRecordingPath }
        fun setLastRecordingPath(path: String?) = synchronized(pathLock) { lastRecordingPath = path }
        fun getIsRecording(): Boolean = synchronized(pathLock) { isRecordingState }
        fun setIsRecording(value: Boolean) = synchronized(pathLock) { isRecordingState = value }
    }

    private var mediaProjection: MediaProjection? = null
    private var mediaRecorder: MediaRecorder? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var recordingPath: String? = null
    private var isRecording = false
    private var isPaused = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "START_RECORDING" -> {
                val resultCode = intent.getIntExtra("resultCode", -1)
                @Suppress("DEPRECATION")
                val data = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra("data", Intent::class.java)
                } else {
                    intent.getParcelableExtra<Intent>("data")
                }
                val filePath = intent.getStringExtra("filePath")
                val audio = intent.getBooleanExtra("audio", true)
                if (resultCode != -1 && data != null) {
                    startRecording(resultCode, data, filePath, audio)
                }
            }
            "STOP_RECORDING" -> {
                stopRecording()
            }
            "PAUSE_RECORDING" -> {
                pauseRecording()
            }
            "RESUME_RECORDING" -> {
                resumeRecording()
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Screen Recording Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Service for screen recording functionality"
                setShowBadge(false)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Recording Screen")
            .setContentText("Screen recording is in progress")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun startRecording(resultCode: Int, data: Intent, filePath: String?, audio: Boolean) {
        if (isRecording) return

        try {
            val windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
            val metrics = DisplayMetrics()
            windowManager.defaultDisplay.getMetrics(metrics)
            val width = metrics.widthPixels
            val height = metrics.heightPixels
            val density = metrics.densityDpi

            // Get MediaProjection
            val mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data)

            // Generate filename
            val timestamp = System.currentTimeMillis()
            val filename = "recording_${timestamp}.mp4"
            
            // Determine output file path
            val outputFile: File
            if (filePath != null) {
                // Ensure directory exists
                val file = File(filePath)
                file.parentFile?.mkdirs()
                outputFile = file
                recordingPath = filePath
            } else {
                // Use Downloads directory
                val downloadsDir = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Android 10+ - use app's external files directory as fallback
                    File(getExternalFilesDir(Environment.DIRECTORY_MOVIES), "recordings").apply {
                        mkdirs()
                    }
                } else {
                    // Android 9 and below - use public Downloads
                    File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "recordings").apply {
                        mkdirs()
                    }
                }
                outputFile = File(downloadsDir, filename)
                recordingPath = outputFile.absolutePath
            }

            // Setup MediaRecorder
            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            mediaRecorder?.apply {
                if (audio) {
                    setAudioSource(MediaRecorder.AudioSource.MIC)
                }
                setVideoSource(MediaRecorder.VideoSource.SURFACE)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setOutputFile(outputFile.absolutePath)
                
                setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                if (audio) {
                    setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                }
                setVideoSize(width, height)
                setVideoEncodingBitRate(8 * 1000 * 1000) // 8 Mbps
                setVideoFrameRate(30)
                if (audio) {
                    setAudioEncodingBitRate(128 * 1000) // 128 kbps
                    setAudioSamplingRate(44100)
                }
            }

            // Prepare MediaRecorder (this creates the surface)
            mediaRecorder?.prepare()
            
            // Create VirtualDisplay to capture screen (must be done before starting MediaRecorder)
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "ScreenRecording",
                width, height, density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                mediaRecorder?.surface,
                null, null
            )
            
            // Start MediaRecorder after VirtualDisplay is created
            mediaRecorder?.start()
            
            isRecording = true
            setIsRecording(true)
            setLastRecordingPath(recordingPath)
            
            Log.d("ScreenRecordingService", "Recording started: $recordingPath, isRecording: $isRecording")
            
            startForeground(NOTIFICATION_ID, createNotification())
            Log.d("ScreenRecordingService", "Recording service started successfully")
        } catch (e: Exception) {
            Log.e("ScreenRecordingService", "Error starting recording", e)
            e.printStackTrace()
            isRecording = false
            setIsRecording(false)
            recordingPath = null
            setLastRecordingPath(null)
            stopSelf()
        }
    }

    private fun stopRecording() {
        Log.d("ScreenRecordingService", "stopRecording called. isRecording: $isRecording, recordingPath: $recordingPath, static isRecording: ${getIsRecording()}")
        
        // Check static state in case service was recreated
        val wasRecording = isRecording || getIsRecording()
        
        // Even if isRecording is false (service might have been restarted),
        // try to stop and save the file if recordingPath exists
        if (!wasRecording && recordingPath == null) {
            Log.w("ScreenRecordingService", "stopRecording called but not recording and no path")
            // Try to get the last known path
            val lastPath = getLastRecordingPath()
            if (lastPath != null) {
                Log.d("ScreenRecordingService", "Using last known recording path: $lastPath")
                recordingPath = lastPath
            } else {
                Log.w("ScreenRecordingService", "No recording path found, cannot stop")
                return
            }
        }
        
        // Update static state
        setIsRecording(false)

        var finalPath: String? = null
        
        try {
            // Stop MediaRecorder first (before setting isRecording = false)
            val wasRecording = isRecording || getIsRecording()
            if (mediaRecorder != null) {
                try {
                    if (wasRecording) {
                        mediaRecorder?.stop()
                        Log.d("ScreenRecordingService", "MediaRecorder stopped")
                    }
                } catch (e: Exception) {
                    Log.e("ScreenRecordingService", "Error stopping MediaRecorder", e)
                    // Continue even if stop fails - file might still be valid
                }
                try {
                    mediaRecorder?.release()
                } catch (e: Exception) {
                    Log.e("ScreenRecordingService", "Error releasing MediaRecorder", e)
                }
                mediaRecorder = null
            } else if (wasRecording) {
                Log.w("ScreenRecordingService", "MediaRecorder is null but wasRecording is true - service may have been recreated")
            }
            
            // Clean up resources
            virtualDisplay?.release()
            virtualDisplay = null
            
            mediaProjection?.stop()
            mediaProjection = null
            
            isRecording = false
            setIsRecording(false)
            isPaused = false
            
            // Save file to Downloads using MediaStore
            if (recordingPath != null) {
                try {
                    val file = File(recordingPath!!)
                    Log.d("ScreenRecordingService", "Checking file: ${file.absolutePath}, exists: ${file.exists()}, size: ${if (file.exists()) file.length() else 0}")
                    
                    // Wait a bit for file system to sync
                    Thread.sleep(100)
                    
                    if (file.exists() && file.length() > 0) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            // Android 10+ - use MediaStore to save to Downloads
                            val timestamp = System.currentTimeMillis()
                            val filename = "recording_$timestamp.mp4"
                            
                            val contentValues = ContentValues().apply {
                                put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                                put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4")
                                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                                put(MediaStore.Video.Media.IS_PENDING, 1)
                            }
                            
                            val uri = contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, contentValues)
                            if (uri != null) {
                                Log.d("ScreenRecordingService", "MediaStore URI created: $uri")
                                
                                // Copy file to MediaStore
                                contentResolver.openOutputStream(uri)?.use { outputStream ->
                                    file.inputStream().use { inputStream ->
                                        inputStream.copyTo(outputStream)
                                        outputStream.flush()
                                    }
                                }
                                
                                // Mark as not pending (makes it visible)
                                contentValues.clear()
                                contentValues.put(MediaStore.Video.Media.IS_PENDING, 0)
                                contentResolver.update(uri, contentValues, null, null)
                                
                                // Get the actual path from MediaStore
                                val mediaStorePath = getRealPathFromURI(uri)
                                if (mediaStorePath != null) {
                                    finalPath = mediaStorePath
                                    Log.d("ScreenRecordingService", "File saved to MediaStore path: $finalPath")
                                } else {
                                    // Fallback: construct path manually
                                    finalPath = "${Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)}/$filename"
                                    Log.d("ScreenRecordingService", "Using constructed path: $finalPath")
                                }
                                
                                // Delete original file
                                try {
                                    if (file.delete()) {
                                        Log.d("ScreenRecordingService", "Original file deleted: ${file.absolutePath}")
                                    }
                                } catch (e: Exception) {
                                    Log.w("ScreenRecordingService", "Could not delete original file", e)
                                }
                            } else {
                                Log.w("ScreenRecordingService", "Failed to insert file into MediaStore, keeping original")
                                finalPath = recordingPath
                            }
                        } else {
                            // Android 9 and below - move file to Downloads
                            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                            if (!downloadsDir.exists()) {
                                downloadsDir.mkdirs()
                            }
                            val targetFile = File(downloadsDir, file.name)
                            
                            try {
                                if (file.renameTo(targetFile)) {
                                    finalPath = targetFile.absolutePath
                                    Log.d("ScreenRecordingService", "File moved to Downloads: $finalPath")
                                } else {
                                    // Try copying instead
                                    file.inputStream().use { input ->
                                        targetFile.outputStream().use { output ->
                                            input.copyTo(output)
                                        }
                                    }
                                    finalPath = targetFile.absolutePath
                                    file.delete() // Delete original
                                    Log.d("ScreenRecordingService", "File copied to Downloads: $finalPath")
                                }
                            } catch (e: Exception) {
                                Log.e("ScreenRecordingService", "Error moving file to Downloads", e)
                                finalPath = recordingPath
                            }
                        }
                    } else {
                        Log.e("ScreenRecordingService", "Recording file not found or empty: $recordingPath")
                        finalPath = recordingPath
                    }
                } catch (e: Exception) {
                    Log.e("ScreenRecordingService", "Error saving to MediaStore", e)
                    e.printStackTrace()
                    finalPath = recordingPath
                }
            } else {
                Log.w("ScreenRecordingService", "recordingPath is null")
            }
            
            // Update the last recording path
            setLastRecordingPath(finalPath)
            Log.d("ScreenRecordingService", "Recording stopped. Final path: $finalPath")
            
        } catch (e: Exception) {
            Log.e("ScreenRecordingService", "Error stopping recording", e)
            e.printStackTrace()
            setLastRecordingPath(recordingPath)
        } finally {
            stopForeground(true)
            stopSelf()
        }
    }

    private fun pauseRecording() {
        if (isRecording && !isPaused) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                mediaRecorder?.pause()
                isPaused = true
            }
        }
    }

    private fun resumeRecording() {
        if (isRecording && isPaused) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                mediaRecorder?.resume()
                isPaused = false
            }
        }
    }
    
    private fun getRealPathFromURI(uri: Uri): String? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+ - DATA column is deprecated, use RELATIVE_PATH and DISPLAY_NAME
            val cursor = contentResolver.query(uri, arrayOf(
                MediaStore.Video.Media.RELATIVE_PATH,
                MediaStore.Video.Media.DISPLAY_NAME
            ), null, null, null)
            if (cursor != null) {
                if (cursor.moveToFirst()) {
                    val relativePathIndex = cursor.getColumnIndex(MediaStore.Video.Media.RELATIVE_PATH)
                    val displayNameIndex = cursor.getColumnIndex(MediaStore.Video.Media.DISPLAY_NAME)
                    if (relativePathIndex >= 0 && displayNameIndex >= 0) {
                        val relativePath = cursor.getString(relativePathIndex) ?: ""
                        val displayName = cursor.getString(displayNameIndex) ?: ""
                        // Construct path: /storage/emulated/0/Download/filename
                        val basePath = Environment.getExternalStorageDirectory().absolutePath
                        val path = if (relativePath.endsWith("/")) {
                            "$basePath/$relativePath$displayName"
                        } else {
                            "$basePath/$relativePath/$displayName"
                        }
                        cursor.close()
                        Log.d("ScreenRecordingService", "Constructed path from MediaStore: $path")
                        return path
                    }
                }
                cursor.close()
            }
        } else {
            // Android 9 and below - use DATA column
            val cursor = contentResolver.query(uri, null, null, null, null)
            if (cursor != null) {
                if (cursor.moveToFirst()) {
                    val index = cursor.getColumnIndex(MediaStore.Video.Media.DATA)
                    if (index >= 0) {
                        val result = cursor.getString(index)
                        cursor.close()
                        return result
                    }
                }
                cursor.close()
            }
        }
        return null
    }
}

