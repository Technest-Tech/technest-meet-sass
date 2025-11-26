import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:dio/dio.dart';
import '../models/room.dart';
import '../models/client_models.dart';
import '../config/app_config.dart';
import '../utils/logger.dart';
import 'http_client_service.dart';
import 'api_request_manager.dart';

class ApiService {
  // Use configuration for base URL
  static String get baseUrl => AppConfig.baseUrl;
  
  // Validate room exists
  static Future<RoomValidation> validateRoom(String roomLink, String type) async {
    try {
      Logger.debug('Validating room - Link: $roomLink, Type: $type', 'ApiService');
      Logger.debug('Request URL: $baseUrl/api/room/validate/$roomLink?type=$type', 'ApiService');
      
      final response = await http.get(
        Uri.parse('$baseUrl/api/room/validate/$roomLink?type=$type'),
        headers: {'Content-Type': 'application/json'},
      );

      Logger.debug('Room validation response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Room validation response - Body: ${response.body}', 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        Logger.debug('Parsed room data: $data', 'ApiService');
        final validation = RoomValidation.fromJson(data);
        Logger.debug('Room validation result - Exists: ${validation.exists}', 'ApiService');
        return validation;
      } else {
        Logger.error('Room validation failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        throw Exception('Failed to validate room: ${response.statusCode}');
      }
    } catch (e) {
      Logger.error('Room validation error: $e', e, null, 'ApiService');
      throw Exception('Error validating room: $e');
    }
  }

  // Verify room password
  static Future<bool> verifyRoomPassword({
    required String roomLink,
    required String accessType,
    required String password,
  }) async {
    try {
      Logger.debug('Verifying room password - Link: $roomLink, Type: $accessType', 'ApiService');
      Logger.debug('Request URL: $baseUrl/api/room/verify-password', 'ApiService');
      
      final requestBody = {
        'roomLink': roomLink,
        'accessType': accessType,
        'password': password,
      };
      Logger.debug('Request body: ${requestBody.toString().replaceAll(password, '***')}', 'ApiService');
      
      final response = await http.post(
        Uri.parse('$baseUrl/api/room/verify-password'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(requestBody),
      );

      Logger.debug('Password verification response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Password verification response - Body: ${response.body}', 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        final isValid = data['valid'] == true;
        Logger.debug('Password verification result - Valid: $isValid', 'ApiService');
        return isValid;
      } else {
        Logger.error('Password verification failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        return false;
      }
    } catch (e) {
      Logger.error('Password verification error: $e', e, null, 'ApiService');
      return false;
    }
  }

  // Get LiveKit token
  static Future<LiveKitTokenResponse> getLiveKitToken({
    required String roomName,
    required String participantName,
    required String participantType,
  }) async {
    try {
      Logger.debug('Getting LiveKit token', 'ApiService');
      Logger.debug('Room: $roomName, Participant: $participantName, Type: $participantType', 'ApiService');
      
      // For observers, use connection-details endpoint which properly handles observer permissions
      // For others, we can use the simpler token endpoint or connection-details
      final bool useConnectionDetails = participantType.toLowerCase() == 'observer';
      
      if (useConnectionDetails) {
        Logger.debug('Using connection-details endpoint for observer', 'ApiService');
        final url = Uri.parse('$baseUrl/api/connection-details').replace(queryParameters: {
          'roomName': roomName,
          'participantName': participantName,
          'participantType': participantType.toLowerCase(), // Ensure lowercase
        });
        
        Logger.debug('Request URL: $url', 'ApiService');
        
        final response = await http.get(url, headers: {'Content-Type': 'application/json'});
        
        Logger.debug('Connection details response - Status: ${response.statusCode}', 'ApiService');
        Logger.debug('Connection details response - Body: ${response.body}', 'ApiService');
        
        if (response.statusCode == 200) {
          final data = json.decode(response.body) as Map<String, dynamic>;
          Logger.debug('Parsed connection details: ${data.toString().substring(0, 100)}...', 'ApiService');
          
          // Map connection-details response to LiveKitTokenResponse format
          return LiveKitTokenResponse(
            token: data['participantToken'] as String,
            livekitUrl: data['serverUrl'] as String,
            roomName: data['roomName'] as String,
            participantName: data['participantName'] as String,
            participantType: participantType,
          );
        } else {
          Logger.error('Connection details request failed with status: ${response.statusCode}', null, null, 'ApiService');
          Logger.error('Response body: ${response.body}', null, null, 'ApiService');
          throw Exception('Failed to get connection details: ${response.statusCode}');
        }
      } else {
        // Use the existing token endpoint for host/guest
        Logger.debug('Request URL: $baseUrl/api/livekit/token', 'ApiService');
        
        final requestBody = {
          'roomName': roomName,
          'participantName': participantName,
          'participantType': participantType,
        };
        Logger.debug('Request body: $requestBody', 'ApiService');
        
        final response = await http.post(
          Uri.parse('$baseUrl/api/livekit/token'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode(requestBody),
        );

        Logger.debug('Token response - Status: ${response.statusCode}', 'ApiService');
        Logger.debug('Token response - Body: ${response.body}', 'ApiService');

        if (response.statusCode == 200) {
          final data = json.decode(response.body) as Map<String, dynamic>;
          Logger.debug('Parsed token data: ${data.toString().substring(0, 100)}...', 'ApiService');
          final tokenResponse = LiveKitTokenResponse.fromJson(data);
          Logger.debug('Token received - URL: ${tokenResponse.livekitUrl}', 'ApiService');
          Logger.debug('Token received - Room: ${tokenResponse.roomName}', 'ApiService');
          return tokenResponse;
        } else {
          Logger.error('Token request failed with status: ${response.statusCode}', null, null, 'ApiService');
          Logger.error('Response body: ${response.body}', null, null, 'ApiService');
          throw Exception('Failed to get token: ${response.statusCode}');
        }
      }
    } catch (e) {
      Logger.error('Token request error: $e', e, null, 'ApiService');
      throw Exception('Error getting LiveKit token: $e');
    }
  }

  // Get connection details
  static Future<Map<String, dynamic>> getConnectionDetails() async {
    try {
      Logger.debug('Getting connection details', 'ApiService');
      Logger.debug('Request URL: $baseUrl/api/connection-details', 'ApiService');
      
      final response = await http.get(
        Uri.parse('$baseUrl/api/connection-details'),
        headers: {'Content-Type': 'application/json'},
      );

      Logger.debug('Connection details response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Connection details response - Body: ${response.body}', 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        Logger.debug('Connection details received: $data', 'ApiService');
        return data;
      } else {
        Logger.error('Connection details failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        throw Exception('Failed to get connection details: ${response.statusCode}');
      }
    } catch (e) {
      Logger.error('Connection details error: $e', e, null, 'ApiService');
      throw Exception('Error getting connection details: $e');
    }
  }

  // Remove participant from room
  static Future<Map<String, dynamic>> removeParticipant({
    required String roomName,
    required String participantIdentity,
  }) async {
    try {
      Logger.debug('Removing participant - Room: $roomName, Participant: $participantIdentity', 'ApiService');
      Logger.debug('Request URL: $baseUrl/api/admin/rooms/$roomName/remove-participant', 'ApiService');
      
      final requestBody = {
        'participantIdentity': participantIdentity,
        'roomName': roomName,
      };
      Logger.debug('Request body: $requestBody', 'ApiService');
      
      final response = await http.post(
        Uri.parse('$baseUrl/api/admin/rooms/$roomName/remove-participant'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(requestBody),
      );

      Logger.debug('Remove participant response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Remove participant response - Body: ${response.body}', 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        Logger.debug('Participant removal successful: $data', 'ApiService');
        return data;
      } else {
        Logger.error('Remove participant failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        throw Exception('Failed to remove participant: ${response.statusCode}');
      }
    } catch (e) {
      Logger.error('Remove participant error: $e', e, null, 'ApiService');
      throw Exception('Error removing participant: $e');
    }
  }

  // Start recording with fallback to simple-start
  static Future<Map<String, dynamic>> startRecording({
    required String roomName,
  }) async {
    // Try main recording endpoint first
    try {
      Logger.debug('Starting recording - Room: $roomName', 'ApiService');
      Logger.debug('Request URL: $baseUrl/api/record/start?roomName=$roomName', 'ApiService');
      
      final response = await http.get(
        Uri.parse('$baseUrl/api/record/start?roomName=$roomName'),
        headers: {'Content-Type': 'application/json'},
      );

      Logger.debug('Start recording response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Start recording response - Body: ${response.body}', 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        Logger.debug('Recording started successfully: $data', 'ApiService');
        return data;
      } else if (response.statusCode == 500) {
        // If server error, try fallback to simple-start
        Logger.warning('Main recording endpoint failed, trying fallback...', 'ApiService');
        return await _startSimpleRecording(roomName);
      } else {
        // Try to parse error message from response
        String errorMessage = 'Failed to start recording';
        try {
          final errorData = json.decode(response.body) as Map<String, dynamic>;
          errorMessage = errorData['error'] as String? ?? 
                        errorData['details'] as String? ?? 
                        errorMessage;
        } catch (_) {
          errorMessage = 'Failed to start recording: ${response.statusCode}';
        }
        
        Logger.error('Start recording failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        throw Exception(errorMessage);
      }
    } catch (e) {
      // If exception occurs, try fallback
      if (e.toString().contains('Internal service panic') || 
          e.toString().contains('500')) {
        Logger.warning('Main recording failed, trying fallback...', 'ApiService');
        try {
          return await _startSimpleRecording(roomName);
        } catch (fallbackError) {
          Logger.error('Fallback recording also failed: $fallbackError', fallbackError, null, 'ApiService');
          throw Exception('Recording is not available. The LiveKit server egress service may not be configured. Please contact your administrator.');
        }
      }
      
      Logger.error('Start recording error: $e', e, null, 'ApiService');
      if (e is Exception) {
        rethrow;
      }
      throw Exception('Error starting recording: $e');
    }
  }

  // Fallback simple recording start
  static Future<Map<String, dynamic>> _startSimpleRecording(String roomName) async {
    try {
      Logger.debug('Trying simple recording endpoint - Room: $roomName', 'ApiService');
      final response = await http.get(
        Uri.parse('$baseUrl/api/record/simple-start?roomName=$roomName'),
        headers: {'Content-Type': 'application/json'},
      );

      Logger.debug('Simple recording response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Simple recording response - Body: ${response.body}', 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        Logger.debug('Simple recording started successfully: $data', 'ApiService');
        return data;
      } else {
        throw Exception('Simple recording also failed: ${response.statusCode}');
      }
    } catch (e) {
      Logger.error('Simple recording error: $e', e, null, 'ApiService');
      rethrow;
    }
  }

  // Stop recording with fallback to simple-stop
  static Future<Map<String, dynamic>> stopRecording({
    required String roomName,
    bool useSimpleStop = false,
  }) async {
    try {
      final endpoint = useSimpleStop 
          ? '/api/record/simple-stop' 
          : '/api/record/stop';
      
      Logger.debug('Stopping recording - Room: $roomName', 'ApiService');
      Logger.debug('Request URL: $baseUrl$endpoint?roomName=$roomName', 'ApiService');
      
      final response = await http.get(
        Uri.parse('$baseUrl$endpoint?roomName=$roomName'),
        headers: {'Content-Type': 'application/json'},
      );

      Logger.debug('Stop recording response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Stop recording response - Body: ${response.body}', 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        Logger.debug('Recording stopped successfully: $data', 'ApiService');
        return data;
      } else if (response.statusCode == 500 && !useSimpleStop) {
        // Try fallback to simple-stop
        Logger.warning('Main stop endpoint failed, trying fallback...', 'ApiService');
        return await stopRecording(roomName: roomName, useSimpleStop: true);
      } else {
        Logger.error('Stop recording failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        throw Exception('Failed to stop recording: ${response.statusCode}');
      }
    } catch (e) {
      Logger.error('Stop recording error: $e', e, null, 'ApiService');
      if (e.toString().contains('500') && !useSimpleStop) {
        // Try fallback
        try {
          return await stopRecording(roomName: roomName, useSimpleStop: true);
        } catch (fallbackError) {
          throw Exception('Error stopping recording: $fallbackError');
        }
      }
      throw Exception('Error stopping recording: $e');
    }
  }

  // Mute/unmute participant
  static Future<Map<String, dynamic>> muteParticipant({
    required String roomName,
    required String participantIdentity,
    required bool mute,
  }) async {
    try {
      Logger.debug('Muting participant - Room: $roomName, Participant: $participantIdentity, Mute: $mute', 'ApiService');
      Logger.debug('Request URL: $baseUrl/api/room/controls/mute-participant', 'ApiService');
      
      final requestBody = {
        'roomName': roomName,
        'participantIdentity': participantIdentity,
        'mute': mute,
      };
      Logger.debug('Request body: $requestBody', 'ApiService');
      
      final response = await http.post(
        Uri.parse('$baseUrl/api/room/controls/mute-participant'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(requestBody),
      );

      Logger.debug('Mute participant response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Mute participant response - Body: ${response.body}', 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        Logger.debug('Participant mute successful: $data', 'ApiService');
        return data;
      } else {
        Logger.error('Mute participant failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        throw Exception('Failed to mute participant: ${response.statusCode}');
      }
    } catch (e) {
      Logger.error('Mute participant error: $e', e, null, 'ApiService');
      throw Exception('Error muting participant: $e');
    }
  }

  // Mute all participants
  static Future<Map<String, dynamic>> muteAllParticipants({
    required String roomName,
    required String hostIdentity,
  }) async {
    try {
      Logger.debug('Muting all participants - Room: $roomName, Host: $hostIdentity', 'ApiService');
      Logger.debug('Request URL: $baseUrl/api/room/controls/mute-all', 'ApiService');
      
      final requestBody = {
        'roomName': roomName,
        'hostIdentity': hostIdentity,
      };
      Logger.debug('Request body: $requestBody', 'ApiService');
      
      final response = await http.post(
        Uri.parse('$baseUrl/api/room/controls/mute-all'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(requestBody),
      );

      Logger.debug('Mute all response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Mute all response - Body: ${response.body}', 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        Logger.debug('Mute all successful: $data', 'ApiService');
        return data;
      } else {
        Logger.error('Mute all failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        throw Exception('Failed to mute all participants: ${response.statusCode}');
      }
    } catch (e) {
      Logger.error('Mute all error: $e', e, null, 'ApiService');
      throw Exception('Error muting all participants: $e');
    }
  }

  // Download recording file
  static Future<String> downloadRecording({
    required String downloadUrl,
    required String filename,
  }) async {
    try {
      Logger.debug('Downloading recording - URL: $downloadUrl, Filename: $filename', 'ApiService');
      
      // Request storage permission on Android
      if (Platform.isAndroid) {
        // For Android 10+ (API 29+), request storage permission
        final storageStatus = await Permission.storage.status;
        if (storageStatus.isDenied) {
          final result = await Permission.storage.request();
          if (result.isDenied) {
            Logger.warning('Storage permission denied', 'ApiService');
          }
        }
      }
      
      // Get download directory - use public Downloads folder
      Directory? downloadDir;
      if (Platform.isAndroid) {
        // For Android, use public Downloads directory
        try {
          // Try to get the public Downloads directory
          // Path: /storage/emulated/0/Download or /sdcard/Download
          final externalDir = await getExternalStorageDirectory();
          if (externalDir != null) {
            // Navigate to public Downloads folder
            // externalDir is typically at: /storage/emulated/0/Android/data/com.example.app/files
            // We need to go to: /storage/emulated/0/Download
            final externalPath = externalDir.path;
            // Extract the base path (before Android/data)
            final basePath = externalPath.split('/Android/data')[0];
            final downloadsPath = '$basePath/Download';
            downloadDir = Directory(downloadsPath);
            
            Logger.debug('Attempting to use Downloads path: $downloadsPath', 'ApiService');
            
            // Try to create directory if it doesn't exist
            if (!await downloadDir.exists()) {
              try {
                await downloadDir.create(recursive: true);
                Logger.debug('Created Downloads directory', 'ApiService');
              } catch (createError) {
                Logger.warning('Could not create Downloads directory: $createError', 'ApiService');
                // Fallback to external storage directory
                downloadDir = externalDir;
              }
            } else {
              Logger.debug('Downloads directory exists', 'ApiService');
            }
          } else {
            // Fallback to app documents
            downloadDir = await getApplicationDocumentsDirectory();
            Logger.warning('Using app documents as fallback', 'ApiService');
          }
        } catch (e) {
          Logger.warning('Error accessing Downloads: $e', 'ApiService');
          // Fallback to app documents if external storage fails
          downloadDir = await getApplicationDocumentsDirectory();
        }
      } else if (Platform.isIOS) {
        // For iOS, use Documents directory (accessible via Files app)
        downloadDir = await getApplicationDocumentsDirectory();
        Logger.debug('Using iOS Documents directory: ${downloadDir?.path}', 'ApiService');
      } else {
        downloadDir = await getApplicationDocumentsDirectory();
      }
      
      if (downloadDir == null) {
        throw Exception('Could not access download directory');
      }
      
      // Ensure directory exists
      if (!await downloadDir.exists()) {
        await downloadDir.create(recursive: true);
      }
      
      // Construct full URL
      final fullUrl = downloadUrl.startsWith('http') 
          ? downloadUrl 
          : '$baseUrl$downloadUrl';
      
      Logger.debug('Full download URL: $fullUrl', 'ApiService');
      
      // Download the file
      final response = await http.get(Uri.parse(fullUrl));
      
      if (response.statusCode == 200) {
        // Save file
        final filePath = '${downloadDir.path}/$filename';
        final file = File(filePath);
        await file.writeAsBytes(response.bodyBytes);
        
        Logger.debug('Recording downloaded successfully to: $filePath', 'ApiService');
        return filePath;
      } else if (response.statusCode == 302 || response.statusCode == 301) {
        // Handle redirect
        final location = response.headers['location'];
        if (location != null) {
          Logger.debug('Following redirect to: $location', 'ApiService');
          return await downloadRecording(
            downloadUrl: location,
            filename: filename,
          );
        }
        throw Exception('Redirect location not found');
      } else {
        Logger.error('Download failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        throw Exception('Failed to download recording: ${response.statusCode}');
      }
    } catch (e) {
      Logger.error('Download recording error: $e', e, null, 'ApiService');
      throw Exception('Error downloading recording: $e');
    }
  }

  // Get waiting room participants list
  static Future<Map<String, dynamic>> getWaitingRoomParticipants({
    required String roomName,
  }) async {
    try {
      Logger.debug('Getting waiting room participants - Room: $roomName', 'ApiService');
      Logger.debug('Request URL: $baseUrl/api/room/waiting-room/list?roomName=$roomName', 'ApiService');
      
      final response = await http.get(
        Uri.parse('$baseUrl/api/room/waiting-room/list?roomName=${Uri.encodeComponent(roomName)}'),
        headers: {'Content-Type': 'application/json'},
      );

      Logger.debug('Waiting room list response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Waiting room list response - Body: ${response.body}', 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        Logger.debug('Waiting room participants received: ${data['count']} participants');
        return data;
      } else {
        Logger.error('Get waiting room list failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        throw Exception('Failed to get waiting room list: ${response.statusCode}');
      }
    } catch (e) {
      Logger.error('Get waiting room list error: $e', e, null, 'ApiService');
      throw Exception('Error getting waiting room list: $e');
    }
  }

  // Admit participant from waiting room
  static Future<Map<String, dynamic>> admitWaitingParticipant({
    required String roomName,
    required String participantId,
  }) async {
    try {
      Logger.debug('Admitting waiting participant - Room: $roomName, Participant: $participantId', 'ApiService');
      Logger.debug('Request URL: $baseUrl/api/room/waiting-room/admit', 'ApiService');
      
      final requestBody = {
        'roomName': roomName,
        'participantId': participantId,
      };
      Logger.debug('Request body: $requestBody', 'ApiService');
      
      final response = await http.post(
        Uri.parse('$baseUrl/api/room/waiting-room/admit'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(requestBody),
      );

      Logger.debug('Admit participant response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Admit participant response - Body: ${response.body}', 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        Logger.debug('Participant admitted successfully: $data', 'ApiService');
        return data;
      } else {
        Logger.error('Admit participant failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        throw Exception('Failed to admit participant: ${response.statusCode}');
      }
    } catch (e) {
      Logger.error('Admit participant error: $e', e, null, 'ApiService');
      throw Exception('Error admitting participant: $e');
    }
  }

  // Reject participant from waiting room
  static Future<Map<String, dynamic>> rejectWaitingParticipant({
    required String roomName,
    required String participantId,
  }) async {
    try {
      Logger.error('Rejecting waiting participant - Room: $roomName, Participant: $participantId', null, null, 'ApiService');
      Logger.error('Request URL: $baseUrl/api/room/waiting-room/reject', null, null, 'ApiService');
      
      final requestBody = {
        'roomName': roomName,
        'participantId': participantId,
      };
      Logger.error('Request body: $requestBody', null, null, 'ApiService');
      
      final response = await http.post(
        Uri.parse('$baseUrl/api/room/waiting-room/reject'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(requestBody),
      );

      Logger.error('Reject participant response - Status: ${response.statusCode}', null, null, 'ApiService');
      Logger.error('Reject participant response - Body: ${response.body}', null, null, 'ApiService');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        Logger.error('Participant rejected successfully: $data', null, null, 'ApiService');
        return data;
      } else {
        Logger.error('Reject participant failed with status: ${response.statusCode}', null, null, 'ApiService');
        Logger.error('Response body: ${response.body}', null, null, 'ApiService');
        throw Exception('Failed to reject participant: ${response.statusCode}');
      }
    } catch (e) {
      Logger.error('Reject participant error: $e', e, null, 'ApiService');
      throw Exception('Error rejecting participant: $e');
    }
  }

  // ========== CLIENT API METHODS ==========

  // Get client rooms
  static Future<List<ClientRoom>> getClientRooms({CancelToken? cancelToken}) async {
    try {
      Logger.debug('Getting client rooms', 'ApiService');

      final dio = await HttpClientService.dio;
      final response = await dio.get(
        '/api/client/rooms',
        cancelToken: cancelToken,
      );

      Logger.debug('Get rooms response - Status: ${response.statusCode}', 'ApiService');

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final rooms = (data['rooms'] as List<dynamic>?)
                ?.map((r) => ClientRoom.fromJson(r as Map<String, dynamic>))
                .toList() ??
            [];
        Logger.debug('Retrieved ${rooms.length} rooms', 'ApiService');
        return rooms;
      } else {
        Logger.error('Get rooms failed with status: ${response.statusCode}', null, null, 'ApiService');
        throw Exception('Failed to get rooms: ${response.statusCode}');
      }
    } on DioException catch (e) {
      Logger.error('Get rooms error: $e', e, null, 'ApiService');
      final error = e.response?.data?['error'] as String? ?? 'Failed to get rooms';
      throw Exception(error);
    } catch (e) {
      Logger.error('Get rooms error: $e', e, null, 'ApiService');
      throw Exception('Error getting rooms: $e');
    }
  }

  // Create client room
  static Future<ClientRoom> createClientRoom(Map<String, dynamic> roomData) async {
    try {
      Logger.debug('Creating client room', 'ApiService');
      Logger.debug('Request body: $roomData', 'ApiService');

      final dio = await HttpClientService.dio;
      final response = await dio.post(
        '/api/client/rooms',
        data: roomData,
      );

      Logger.debug('Create room response - Status: ${response.statusCode}', 'ApiService');

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data as Map<String, dynamic>;
        final room = ClientRoom.fromJson(data['room'] as Map<String, dynamic>);
        Logger.debug('Room created successfully: ${room.name}', 'ApiService');
        return room;
      } else {
        final error = (response.data as Map<String, dynamic>?)?['error'] as String? ?? 'Failed to create room';
        Logger.error('Create room failed: $error', null, null, 'ApiService');
        throw Exception(error);
      }
    } on DioException catch (e) {
      Logger.error('Create room error: $e', e, null, 'ApiService');
      final error = e.response?.data?['error'] as String? ?? 'Failed to create room';
      throw Exception(error);
    } catch (e) {
      Logger.error('Create room error: $e', e, null, 'ApiService');
      if (e is Exception) {
        rethrow;
      }
      throw Exception('Error creating room: $e');
    }
  }

  // Update client room
  static Future<ClientRoom> updateClientRoom(String roomId, Map<String, dynamic> roomData) async {
    try {
      Logger.debug('Updating client room - ID: $roomId', 'ApiService');
      Logger.debug('Request body: $roomData', 'ApiService');

      final dio = await HttpClientService.dio;
      final response = await dio.put(
        '/api/client/rooms/$roomId',
        data: roomData,
      );

      Logger.debug('Update room response - Status: ${response.statusCode}', 'ApiService');
      Logger.debug('Update room response - Data type: ${response.data.runtimeType}', 'ApiService');
      Logger.debug('Update room response - Data: ${response.data}', 'ApiService');

      if (response.statusCode == 200) {
        if (response.data == null) {
          Logger.error('Update room response data is null', null, null, 'ApiService');
          throw Exception('Update room response data is null');
        }

        final data = response.data as Map<String, dynamic>?;
        if (data == null) {
          Logger.error('Update room response data is not a Map', null, null, 'ApiService');
          throw Exception('Update room response data is not a Map');
        }

        if (!data.containsKey('room')) {
          Logger.error('Update room response missing "room" field', null, null, 'ApiService');
          Logger.error('Available keys: ${data.keys}', null, null, 'ApiService');
          throw Exception('Update room response missing "room" field');
        }

        final roomData = data['room'];
        if (roomData == null) {
          Logger.error('Update room response "room" field is null', null, null, 'ApiService');
          throw Exception('Update room response "room" field is null');
        }

        final room = ClientRoom.fromJson(roomData as Map<String, dynamic>);
        Logger.debug('Room updated successfully: ${room.name}', 'ApiService');
        return room;
      } else {
        final error = (response.data as Map<String, dynamic>?)?['error'] as String? ?? 'Failed to update room';
        Logger.error('Update room failed: $error', null, null, 'ApiService');
        throw Exception(error);
      }
    } on DioException catch (e) {
      Logger.error('Update room DioException: $e', null, null, 'ApiService');
      Logger.error('Response: ${e.response?.data}', null, null, 'ApiService');
      Logger.error('Status code: ${e.response?.statusCode}', null, null, 'ApiService');
      final error = e.response?.data?['error'] as String? ?? 'Failed to update room';
      throw Exception(error);
    } catch (e) {
      Logger.error('Update room error: $e', e, null, 'ApiService');
      Logger.error('Error type: ${e.runtimeType}', null, null, 'ApiService');
      if (e is Exception) {
        rethrow;
      }
      throw Exception('Error updating room: $e');
    }
  }

  // Delete client room
  static Future<void> deleteClientRoom(String roomId) async {
    try {
      Logger.debug('Deleting client room - ID: $roomId', 'ApiService');

      final dio = await HttpClientService.dio;
      final response = await dio.delete('/api/client/rooms/$roomId');

      Logger.debug('Delete room response - Status: ${response.statusCode}', 'ApiService');

      if (response.statusCode == 200 || response.statusCode == 204) {
        Logger.debug('Room deleted successfully', 'ApiService');
      } else {
        final error = (response.data as Map<String, dynamic>?)?['error'] as String? ?? 'Failed to delete room';
        Logger.error('Delete room failed: $error', null, null, 'ApiService');
        throw Exception(error);
      }
    } on DioException catch (e) {
      Logger.error('Delete room error: $e', e, null, 'ApiService');
      final error = e.response?.data?['error'] as String? ?? 'Failed to delete room';
      throw Exception(error);
    } catch (e) {
      Logger.error('Delete room error: $e', e, null, 'ApiService');
      if (e is Exception) {
        rethrow;
      }
      throw Exception('Error deleting room: $e');
    }
  }

  // Get client subscription
  static Future<ClientSubscription> getClientSubscription() async {
    try {
      Logger.debug('Getting client subscription', 'ApiService');

      final dio = await HttpClientService.dio;
      final response = await dio.get('/api/client/subscription');

      Logger.debug('Get subscription response - Status: ${response.statusCode}', 'ApiService');

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final subscription = ClientSubscription.fromJson(data);
        Logger.debug('Subscription retrieved: ${subscription.status}', 'ApiService');
        return subscription;
      } else {
        Logger.error('Get subscription failed with status: ${response.statusCode}', null, null, 'ApiService');
        throw Exception('Failed to get subscription: ${response.statusCode}');
      }
    } on DioException catch (e) {
      Logger.error('Get subscription error: $e', e, null, 'ApiService');
      final error = e.response?.data?['error'] as String? ?? 'Failed to get subscription';
      throw Exception(error);
    } catch (e) {
      Logger.error('Get subscription error: $e', e, null, 'ApiService');
      throw Exception('Error getting subscription: $e');
    }
  }

  // Get client limits
  static Future<ClientLimits> getClientLimits() async {
    try {
      Logger.debug('Getting client limits', 'ApiService');

      final dio = await HttpClientService.dio;
      final response = await dio.get('/api/client/limits');

      Logger.debug('Get limits response - Status: ${response.statusCode}', 'ApiService');

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final limits = ClientLimits.fromJson(data);
        Logger.debug('Limits retrieved', 'ApiService');
        return limits;
      } else {
        Logger.error('Get limits failed with status: ${response.statusCode}', null, null, 'ApiService');
        throw Exception('Failed to get limits: ${response.statusCode}');
      }
    } on DioException catch (e) {
      Logger.error('Get limits error: $e', e, null, 'ApiService');
      final error = e.response?.data?['error'] as String? ?? 'Failed to get limits';
      throw Exception(error);
    } catch (e) {
      Logger.error('Get limits error: $e', e, null, 'ApiService');
      throw Exception('Error getting limits: $e');
    }
  }

  // Get single client room
  static Future<ClientRoom> getClientRoom(String roomId) async {
    try {
      Logger.debug('Getting client room - ID: $roomId', 'ApiService');

      final dio = await HttpClientService.dio;
      final response = await dio.get('/api/client/rooms/$roomId');

      Logger.debug('Get room response - Status: ${response.statusCode}', 'ApiService');

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final room = ClientRoom.fromJson(data['room'] as Map<String, dynamic>);
        Logger.debug('Room retrieved: ${room.name}', 'ApiService');
        return room;
      } else {
        Logger.error('Get room failed with status: ${response.statusCode}', null, null, 'ApiService');
        throw Exception('Failed to get room: ${response.statusCode}');
      }
    } on DioException catch (e) {
      Logger.error('Get room error: $e', e, null, 'ApiService');
      final error = e.response?.data?['error'] as String? ?? 'Failed to get room';
      throw Exception(error);
    } catch (e) {
      Logger.error('Get room error: $e', e, null, 'ApiService');
      throw Exception('Error getting room: $e');
    }
  }

  // Check room name availability
  static Future<Map<String, dynamic>> checkRoomName(String roomName) async {
    try {
      Logger.debug('Checking room name - Name: $roomName', 'ApiService');

      final dio = await HttpClientService.dio;
      final response = await dio.post(
        '/api/client/rooms/check-name',
        data: {'roomName': roomName},
      );

      Logger.debug('Check name response - Status: ${response.statusCode}', 'ApiService');

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        Logger.debug('Room name check completed - Available: ${data['available']}');
        return data;
      } else {
        Logger.error('Check name failed with status: ${response.statusCode}', null, null, 'ApiService');
        throw Exception('Failed to check room name: ${response.statusCode}');
      }
    } on DioException catch (e) {
      Logger.error('Check name error: $e', e, null, 'ApiService');
      final error = e.response?.data?['error'] as String? ?? 'Failed to check room name';
      throw Exception(error);
    } catch (e) {
      Logger.error('Check name error: $e', e, null, 'ApiService');
      throw Exception('Error checking room name: $e');
    }
  }
}
