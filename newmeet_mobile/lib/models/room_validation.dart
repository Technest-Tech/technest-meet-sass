import 'room.dart';

class RoomValidation {
  final bool exists;
  final Room? room;

  RoomValidation({
    required this.exists,
    this.room,
  });

  factory RoomValidation.fromJson(Map<String, dynamic> json) {
    return RoomValidation(
      exists: json['exists'] as bool,
      room: json['room'] != null ? Room.fromJson(json['room'] as Map<String, dynamic>) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'exists': exists,
      'room': room?.toJson(),
    };
  }
}
