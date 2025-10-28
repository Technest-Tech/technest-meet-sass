import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/room.dart';
import '../config/app_config.dart';
import 'admin_auth_service.dart';

class AdminRoomService {
  static String get _baseUrl => AppConfig.baseUrl;

  // Get all rooms
  static Future<List<Room>> getRooms() async {
    try {
      final headers = await AdminAuthService.getAuthHeaders();
      final response = await http.get(
        Uri.parse('$_baseUrl/api/admin/rooms'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final roomsData = data['rooms'] as List;
        return roomsData.map((roomData) => Room.fromJson(roomData)).toList();
      } else {
        throw Exception('Failed to load rooms: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Create a new room
  static Future<Room> createRoom({
    required String name,
    String? description,
    bool hostApproval = false,
    int maxParticipants = 50,
    bool isActive = true,
    bool canRecord = false,
  }) async {
    try {
      final headers = await AdminAuthService.getAuthHeaders();
      final response = await http.post(
        Uri.parse('$_baseUrl/api/admin/rooms'),
        headers: headers,
        body: jsonEncode({
          'name': name,
          'description': description,
          'hostApproval': hostApproval,
          'maxParticipants': maxParticipants,
          'isActive': isActive,
          'canRecord': canRecord,
        }),
      );

      if (response.statusCode == 201) {
        final roomData = jsonDecode(response.body);
        return Room.fromJson(roomData);
      } else {
        final errorData = jsonDecode(response.body);
        throw Exception('Failed to create room: ${errorData['error'] ?? 'Unknown error'}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Update a room
  static Future<Room> updateRoom({
    required String id,
    required String name,
    String? description,
    bool? hostApproval,
    int? maxParticipants,
    bool? isActive,
    bool? canRecord,
  }) async {
    try {
      final headers = await AdminAuthService.getAuthHeaders();
      final response = await http.put(
        Uri.parse('$_baseUrl/api/admin/rooms'),
        headers: headers,
        body: jsonEncode({
          'id': id,
          'name': name,
          'description': description,
          'hostApproval': hostApproval,
          'maxParticipants': maxParticipants,
          'isActive': isActive,
          'canRecord': canRecord,
        }),
      );

      if (response.statusCode == 200) {
        final roomData = jsonDecode(response.body);
        return Room.fromJson(roomData);
      } else {
        final errorData = jsonDecode(response.body);
        throw Exception('Failed to update room: ${errorData['error'] ?? 'Unknown error'}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Delete a room
  static Future<void> deleteRoom(String roomId) async {
    try {
      final headers = await AdminAuthService.getAuthHeaders();
      final response = await http.delete(
        Uri.parse('$_baseUrl/api/admin/rooms/$roomId'),
        headers: headers,
      );

      if (response.statusCode != 200) {
        final errorData = jsonDecode(response.body);
        throw Exception('Failed to delete room: ${errorData['error'] ?? 'Unknown error'}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // End a meeting
  static Future<void> endMeeting(String roomId) async {
    try {
      final headers = await AdminAuthService.getAuthHeaders();
      final response = await http.post(
        Uri.parse('$_baseUrl/api/admin/rooms/$roomId/end-meeting'),
        headers: headers,
      );

      if (response.statusCode != 200) {
        final errorData = jsonDecode(response.body);
        throw Exception('Failed to end meeting: ${errorData['error'] ?? 'Unknown error'}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Remove a participant
  static Future<void> removeParticipant(String roomId, String participantId) async {
    try {
      final headers = await AdminAuthService.getAuthHeaders();
      final response = await http.post(
        Uri.parse('$_baseUrl/api/admin/rooms/$roomId/remove-participant'),
        headers: headers,
        body: jsonEncode({
          'participantId': participantId,
        }),
      );

      if (response.statusCode != 200) {
        final errorData = jsonDecode(response.body);
        throw Exception('Failed to remove participant: ${errorData['error'] ?? 'Unknown error'}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }
}
