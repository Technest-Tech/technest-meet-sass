import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/room.dart';
import '../config/app_config.dart';

class ApiService {
  // Use configuration for base URL
  static String get baseUrl => AppConfig.baseUrl;
  
  // Validate room exists
  static Future<RoomValidation> validateRoom(String roomLink, String type) async {
    try {
      print('🔍 API: Validating room - Link: $roomLink, Type: $type');
      print('🔍 API: Request URL: $baseUrl/api/room/validate/$roomLink?type=$type');
      
      final response = await http.get(
        Uri.parse('$baseUrl/api/room/validate/$roomLink?type=$type'),
        headers: {'Content-Type': 'application/json'},
      );

      print('🔍 API: Room validation response - Status: ${response.statusCode}');
      print('🔍 API: Room validation response - Body: ${response.body}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        print('🔍 API: Parsed room data: $data');
        final validation = RoomValidation.fromJson(data);
        print('🔍 API: Room validation result - Exists: ${validation.exists}');
        return validation;
      } else {
        print('❌ API: Room validation failed with status: ${response.statusCode}');
        print('❌ API: Response body: ${response.body}');
        throw Exception('Failed to validate room: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ API: Room validation error: $e');
      throw Exception('Error validating room: $e');
    }
  }

  // Get LiveKit token
  static Future<LiveKitTokenResponse> getLiveKitToken({
    required String roomName,
    required String participantName,
    required String participantType,
  }) async {
    try {
      print('🎫 API: Getting LiveKit token');
      print('🎫 API: Room: $roomName, Participant: $participantName, Type: $participantType');
      print('🎫 API: Request URL: $baseUrl/api/livekit/token');
      
      final requestBody = {
        'roomName': roomName,
        'participantName': participantName,
        'participantType': participantType,
      };
      print('🎫 API: Request body: $requestBody');
      
      final response = await http.post(
        Uri.parse('$baseUrl/api/livekit/token'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(requestBody),
      );

      print('🎫 API: Token response - Status: ${response.statusCode}');
      print('🎫 API: Token response - Body: ${response.body}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        print('🎫 API: Parsed token data: ${data.toString().substring(0, 100)}...');
        final tokenResponse = LiveKitTokenResponse.fromJson(data);
        print('🎫 API: Token received - URL: ${tokenResponse.livekitUrl}');
        print('🎫 API: Token received - Room: ${tokenResponse.roomName}');
        return tokenResponse;
      } else {
        print('❌ API: Token request failed with status: ${response.statusCode}');
        print('❌ API: Response body: ${response.body}');
        throw Exception('Failed to get token: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ API: Token request error: $e');
      throw Exception('Error getting LiveKit token: $e');
    }
  }

  // Get connection details
  static Future<Map<String, dynamic>> getConnectionDetails() async {
    try {
      print('🔗 API: Getting connection details');
      print('🔗 API: Request URL: $baseUrl/api/connection-details');
      
      final response = await http.get(
        Uri.parse('$baseUrl/api/connection-details'),
        headers: {'Content-Type': 'application/json'},
      );

      print('🔗 API: Connection details response - Status: ${response.statusCode}');
      print('🔗 API: Connection details response - Body: ${response.body}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        print('🔗 API: Connection details received: $data');
        return data;
      } else {
        print('❌ API: Connection details failed with status: ${response.statusCode}');
        print('❌ API: Response body: ${response.body}');
        throw Exception('Failed to get connection details: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ API: Connection details error: $e');
      throw Exception('Error getting connection details: $e');
    }
  }
}
