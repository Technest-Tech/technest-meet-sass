import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/logger.dart';

/// Model for stored room data
class StoredRoom {
  final String roomName;
  final String? roomId;
  final String? participantName;
  final String participantType;
  final DateTime lastAccessed;
  final bool isFavorite;

  StoredRoom({
    required this.roomName,
    this.roomId,
    this.participantName,
    required this.participantType,
    required this.lastAccessed,
    this.isFavorite = false,
  });

  Map<String, dynamic> toJson() {
    return {
      'roomName': roomName,
      'roomId': roomId,
      'participantName': participantName,
      'participantType': participantType,
      'lastAccessed': lastAccessed.toIso8601String(),
      'isFavorite': isFavorite,
    };
  }

  factory StoredRoom.fromJson(Map<String, dynamic> json) {
    return StoredRoom(
      roomName: json['roomName'] as String,
      roomId: json['roomId'] as String?,
      participantName: json['participantName'] as String?,
      participantType: json['participantType'] as String? ?? 'host',
      lastAccessed: DateTime.parse(json['lastAccessed'] as String),
      isFavorite: json['isFavorite'] as bool? ?? false,
    );
  }
}

/// Service for managing room history storage
class RoomStorageService {
  static const String _roomsKey = 'recent_rooms';
  static const int _maxRooms = 50; // Maximum number of rooms to store

  /// Save a room to history
  static Future<void> saveRoom({
    required String roomName,
    String? roomId,
    String? participantName,
    String participantType = 'host',
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rooms = await getRecentRooms();

      // Remove existing room with same name to avoid duplicates
      rooms.removeWhere((room) => room.roomName == roomName);

      // Add new room at the beginning
      final newRoom = StoredRoom(
        roomName: roomName,
        roomId: roomId,
        participantName: participantName,
        participantType: participantType,
        lastAccessed: DateTime.now(),
      );

      rooms.insert(0, newRoom);

      // Keep only the most recent rooms
      if (rooms.length > _maxRooms) {
        rooms.removeRange(_maxRooms, rooms.length);
      }

      // Save to SharedPreferences
      final roomsJson = rooms.map((room) => room.toJson()).toList();
      await prefs.setString(_roomsKey, jsonEncode(roomsJson));

      Logger.debug('Room saved to history: $roomName', 'RoomStorage');
    } catch (e, stackTrace) {
      Logger.error('Failed to save room: $e', e, stackTrace, 'RoomStorage');
    }
  }

  /// Get all recent rooms sorted by last accessed time
  static Future<List<StoredRoom>> getRecentRooms() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final roomsJson = prefs.getString(_roomsKey);

      if (roomsJson == null || roomsJson.isEmpty) {
        return [];
      }

      final List<dynamic> roomsList =
          (jsonDecode(roomsJson) as List<dynamic>);
      final rooms = roomsList
          .map((json) => StoredRoom.fromJson(json as Map<String, dynamic>))
          .toList();

      // Sort by last accessed (most recent first)
      rooms.sort((a, b) => b.lastAccessed.compareTo(a.lastAccessed));

      return rooms;
    } catch (e, stackTrace) {
      Logger.error('Failed to get recent rooms: $e', e, stackTrace, 'RoomStorage');
      return [];
    }
  }

  /// Get favorite rooms only
  static Future<List<StoredRoom>> getFavoriteRooms() async {
    final rooms = await getRecentRooms();
    return rooms.where((room) => room.isFavorite).toList();
  }

  /// Toggle favorite status of a room
  static Future<void> toggleFavorite(String roomName) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rooms = await getRecentRooms();

      final roomIndex = rooms.indexWhere((room) => room.roomName == roomName);
      if (roomIndex != -1) {
        final room = rooms[roomIndex];
        final updatedRoom = StoredRoom(
          roomName: room.roomName,
          roomId: room.roomId,
          participantName: room.participantName,
          participantType: room.participantType,
          lastAccessed: room.lastAccessed,
          isFavorite: !room.isFavorite,
        );
        rooms[roomIndex] = updatedRoom;

        final roomsJson = rooms.map((r) => r.toJson()).toList();
        await prefs.setString(_roomsKey, jsonEncode(roomsJson));

        Logger.debug('Toggled favorite for room: $roomName', 'RoomStorage');
      }
    } catch (e, stackTrace) {
      Logger.error('Failed to toggle favorite: $e', e, stackTrace, 'RoomStorage');
    }
  }

  /// Delete a room from history
  static Future<void> deleteRoom(String roomName) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rooms = await getRecentRooms();

      rooms.removeWhere((room) => room.roomName == roomName);

      final roomsJson = rooms.map((room) => room.toJson()).toList();
      await prefs.setString(_roomsKey, jsonEncode(roomsJson));

      Logger.debug('Room deleted from history: $roomName', 'RoomStorage');
    } catch (e, stackTrace) {
      Logger.error('Failed to delete room: $e', e, stackTrace, 'RoomStorage');
    }
  }

  /// Clear all room history
  static Future<void> clearHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_roomsKey);
      Logger.info('Room history cleared', 'RoomStorage');
    } catch (e, stackTrace) {
      Logger.error('Failed to clear history: $e', e, stackTrace, 'RoomStorage');
    }
  }

  /// Get default participant name from stored preferences
  static Future<String?> getDefaultParticipantName() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString('default_participant_name');
    } catch (e) {
      return null;
    }
  }

  /// Save default participant name
  static Future<void> setDefaultParticipantName(String name) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('default_participant_name', name);
      Logger.debug('Default participant name saved: $name', 'RoomStorage');
    } catch (e, stackTrace) {
      Logger.error('Failed to save default name: $e', e, stackTrace, 'RoomStorage');
    }
  }
}


