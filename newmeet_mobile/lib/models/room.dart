import 'package:json_annotation/json_annotation.dart';

part 'room.g.dart';

@JsonSerializable()
class RoomModel {
  final String id;
  final String name;
  final String? description;
  final bool hostApproval;
  final int? maxParticipants;
  final bool isActive;
  final String? createdAt;
  final String? hostLink;
  final String? guestLink;
  final List<Participant>? participants;

  const RoomModel({
    required this.id,
    required this.name,
    this.description,
    required this.hostApproval,
    this.maxParticipants,
    required this.isActive,
    this.createdAt,
    this.hostLink,
    this.guestLink,
    this.participants,
  });

  factory RoomModel.fromJson(Map<String, dynamic> json) => _$RoomModelFromJson(json);
  Map<String, dynamic> toJson() => _$RoomModelToJson(this);
}

@JsonSerializable()
class Participant {
  final String id;
  final String name;
  final String type;

  const Participant({
    required this.id,
    required this.name,
    required this.type,
  });

  factory Participant.fromJson(Map<String, dynamic> json) => _$ParticipantFromJson(json);
  Map<String, dynamic> toJson() => _$ParticipantToJson(this);
}

@JsonSerializable()
class RoomValidation {
  final bool exists;
  final RoomModel? room;

  const RoomValidation({
    required this.exists,
    this.room,
  });

  factory RoomValidation.fromJson(Map<String, dynamic> json) => _$RoomValidationFromJson(json);
  Map<String, dynamic> toJson() => _$RoomValidationToJson(this);
}

@JsonSerializable()
class LiveKitTokenResponse {
  final String token;
  final String livekitUrl;
  final String roomName;
  final String participantName;
  final String participantType;

  const LiveKitTokenResponse({
    required this.token,
    required this.livekitUrl,
    required this.roomName,
    required this.participantName,
    required this.participantType,
  });

  factory LiveKitTokenResponse.fromJson(Map<String, dynamic> json) => _$LiveKitTokenResponseFromJson(json);
  Map<String, dynamic> toJson() => _$LiveKitTokenResponseToJson(this);
}
