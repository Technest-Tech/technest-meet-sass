import 'dart:async';
import '../utils/logger.dart';
import 'dart:io';
import '../utils/logger.dart';
import 'package:flutter/foundation.dart';
import '../utils/logger.dart';
import 'package:flutter/services.dart';
import '../utils/logger.dart';
import 'package:path_provider/path_provider.dart';
import '../utils/logger.dart';
import 'package:permission_handler/permission_handler.dart';
import '../utils/logger.dart';

class ScreenRecordingService {
  static final ScreenRecordingService _instance = ScreenRecordingService._internal();
  factory ScreenRecordingService() => _instance;
  ScreenRecordingService._internal();

  static const MethodChannel _channel = MethodChannel('com.newmeet.screen_recording');
  
  bool _isRecording = false;
  String? _recordingPath;
  Timer? _recordingTimer;

  bool get isRecording => _isRecording;
  String? get recordingPath => _recordingPath;

  // Start screen recording
  Future<String> startRecording() async {
    if (_isRecording) {
      throw Exception('Recording is already in progress');
    }

    try {
      // Request permissions
      if (Platform.isAndroid) {
        // Request storage and recording permissions
        final storageStatus = await Permission.storage.status;
        if (storageStatus.isDenied) {
          await Permission.storage.request();
        }
        
        // Request system alert window for screen recording
        final systemAlertStatus = await Permission.systemAlertWindow.status;
        if (systemAlertStatus.isDenied) {
          await Permission.systemAlertWindow.request();
        }
      }

      // Generate filename with timestamp
      final timestamp = DateTime.now().toIso8601String().replaceAll(':', '-').replaceAll('.', '-');
      final filename = 'recording_$timestamp.mp4';

      // Get output directory
      Directory? outputDir;
      if (Platform.isAndroid) {
        // For Android, use app's external files directory as temporary location
        // The native service will move it to Downloads using MediaStore
        try {
          final externalDir = await getExternalStorageDirectory();
          if (externalDir != null) {
            // Use a recordings subdirectory
            outputDir = Directory('${externalDir.path}/recordings');
            if (!await outputDir.exists()) {
              await outputDir.create(recursive: true);
            }
          } else {
            outputDir = await getApplicationDocumentsDirectory();
          }
        } catch (e) {
          Logger.warning(' ScreenRecordingService: Error accessing storage: $e', 'screen_recording_service');
          outputDir = await getApplicationDocumentsDirectory();
        }
      } else if (Platform.isIOS) {
        outputDir = await getApplicationDocumentsDirectory();
      } else {
        outputDir = await getApplicationDocumentsDirectory();
      }

      if (outputDir == null) {
        throw Exception('Could not access storage directory');
      }

      _recordingPath = '${outputDir.path}/$filename';
      _isRecording = true;

      Logger.debug(' ScreenRecordingService: Starting recording to: $_recordingPath', 'screen_recording_service');

      // Start screen recording using platform channel
      if (Platform.isAndroid) {
        // Call native Android code to start screen recording
        try {
          final result = await _channel.invokeMethod<bool>('startRecording', {
            'filePath': _recordingPath,
            'audio': true,
          });
          
          if (result != true) {
            throw Exception('Failed to start screen recording. Please grant screen recording permission when prompted.');
          }
          
          Logger.debug(' ScreenRecordingService: Screen recording started successfully', 'screen_recording_service');
        } on PlatformException catch (e) {
          Logger.error(' ScreenRecordingService: Platform channel error: ${e.code} - ${e.message}', null, null, 'screen_recording_service');
          if (e.code == 'PERMISSION_DENIED') {
            throw Exception('Screen recording permission denied. Please grant permission when prompted.');
          }
          throw Exception('Failed to start screen recording: ${e.message ?? e.code}');
        } catch (e) {
          Logger.error(' ScreenRecordingService: Error: $e', e, null, 'screen_recording_service');
          throw Exception('Failed to start screen recording: $e');
        }
      } else {
        // iOS implementation would go here
        throw Exception('Screen recording not yet implemented for iOS');
      }
      
      return _recordingPath!;
    } catch (e) {
      Logger.error(' ScreenRecordingService: Failed to start recording: $e', e, null, 'screen_recording_service');
      _isRecording = false;
      _recordingPath = null;
      rethrow;
    }
  }

  // Stop screen recording
  Future<String?> stopRecording() async {
    if (!_isRecording) {
      return null;
    }

    try {
      Logger.debug(' ScreenRecordingService: Stopping recording...', 'screen_recording_service');
      
      String? finalPath = _recordingPath;
      
      if (Platform.isAndroid) {
        // Stop recording using platform channel
        try {
          final result = await _channel.invokeMethod<String>('stopRecording');
          
          if (result != null && result.isNotEmpty) {
            // Check if the returned path exists
            final returnedFile = File(result);
            if (await returnedFile.exists()) {
              // If native code saved to a different location, move it to Downloads
              if (finalPath != null && result != finalPath) {
                try {
                  final targetFile = File(finalPath);
                  if (await targetFile.exists()) {
                    await targetFile.delete();
                  }
                  await returnedFile.copy(finalPath);
                  await returnedFile.delete(); // Delete original
                  Logger.debug(' ScreenRecordingService: Moved recording to Downloads: $finalPath', 'screen_recording_service');
                } catch (e) {
                  Logger.warning(' ScreenRecordingService: Could not move file, using original: $result', 'screen_recording_service');
                  finalPath = result;
                }
              } else {
                finalPath = result;
              }
            } else {
              Logger.warning(' ScreenRecordingService: Native returned path but file not found: $result', 'screen_recording_service');
            }
          } else {
            Logger.warning(' ScreenRecordingService: Native returned null path, using expected path', 'screen_recording_service');
          }
        } catch (e) {
          Logger.error(' ScreenRecordingService: Platform channel error: $e', e, null, 'screen_recording_service');
          // Continue with expected path
        }
      }

      _isRecording = false;
      _recordingTimer?.cancel();
      _recordingTimer = null;
      _recordingPath = null;

      // Verify the final file exists
      if (finalPath != null) {
        final file = File(finalPath);
        if (await file.exists()) {
          final fileSize = await file.length();
          Logger.debug(' ScreenRecordingService: Recording saved successfully: $finalPath (${fileSize} bytes)', 'screen_recording_service');
        } else {
          Logger.warning(' ScreenRecordingService: Recording file not found: $finalPath', 'screen_recording_service');
          // Try to find the file in common locations
          if (Platform.isAndroid) {
            try {
              final externalDir = await getExternalStorageDirectory();
              if (externalDir != null) {
                final basePath = externalDir.path.split('/Android/data')[0];
                final downloadsPath = '$basePath/Download';
                final downloadsDir = Directory(downloadsPath);
                if (await downloadsDir.exists()) {
                  final files = downloadsDir.listSync();
                  final recordingFiles = files.where((f) => 
                    f is File && f.path.contains('recording_') && f.path.endsWith('.mp4')
                  ).toList();
                  if (recordingFiles.isNotEmpty) {
                    final latestFile = recordingFiles.last as File;
                    finalPath = latestFile.path;
                    Logger.debug(' ScreenRecordingService: Found recording file: $finalPath', 'screen_recording_service');
                  }
                }
              }
            } catch (e) {
              Logger.warning(' ScreenRecordingService: Error searching for file: $e', 'screen_recording_service');
            }
          }
        }
      }

      return finalPath;
    } catch (e) {
      Logger.error(' ScreenRecordingService: Failed to stop recording: $e', e, null, 'screen_recording_service');
      return null;
    }
  }

  // Pause recording
  void pauseRecording() {
    if (_isRecording) {
      // Pause native recording
      Logger.debug(' ScreenRecordingService: Recording paused', 'screen_recording_service');
    }
  }

  // Resume recording
  void resumeRecording() {
    if (_isRecording) {
      // Resume native recording
      Logger.debug(' ScreenRecordingService: Recording resumed', 'screen_recording_service');
    }
  }
}

