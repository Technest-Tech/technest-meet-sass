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
  
  // Feature flags
  final bool? canRecord;
  final bool? requireWaitingRoom;
  final bool? allowGuestUnmute;
  final bool? enablePrivateChat;
  final bool? enableScreenAnnotation;
  final bool? enableFileSharing;
  final bool? enablePdfViewer;
  final bool? enableReactions;
  final bool? enableRaiseHand;
  final bool? enableE2EE;
  final bool? enableCollaborativeWhiteboard;
  final bool? enableNormalWhiteboard;
  final bool? enableManageParticipants;
  final bool? enableVirtualBackground;
  final bool? enableNoiseCancellation;
  final bool? enableStudentMonitorPiP;
  final bool? allowMultipleHosts;
  final bool? passwordRequired;
  final String? passwordFor;

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
    this.canRecord,
    this.requireWaitingRoom,
    this.allowGuestUnmute,
    this.enablePrivateChat,
    this.enableScreenAnnotation,
    this.enableFileSharing,
    this.enablePdfViewer,
    this.enableReactions,
    this.enableRaiseHand,
    this.enableE2EE,
    this.enableCollaborativeWhiteboard,
    this.enableNormalWhiteboard,
    this.enableManageParticipants,
    this.enableVirtualBackground,
    this.enableNoiseCancellation,
    this.enableStudentMonitorPiP,
    this.allowMultipleHosts,
    this.passwordRequired,
    this.passwordFor,
  });

  factory RoomModel.fromJson(Map<String, dynamic> json) => _$RoomModelFromJson(json);
  Map<String, dynamic> toJson() => _$RoomModelToJson(this);
  
  // Helper method to extract features
  RoomFeatures get features => RoomFeatures(
    canRecord: canRecord ?? false,
    requireWaitingRoom: requireWaitingRoom ?? false,
    allowGuestUnmute: allowGuestUnmute ?? false,
    enablePrivateChat: enablePrivateChat ?? false,
    enableScreenAnnotation: enableScreenAnnotation ?? false,
    enableFileSharing: enableFileSharing ?? false,
    enablePdfViewer: enablePdfViewer ?? false,
    enableReactions: enableReactions ?? false,
    enableRaiseHand: enableRaiseHand ?? false,
    enableE2EE: enableE2EE ?? false,
    enableCollaborativeWhiteboard: enableCollaborativeWhiteboard ?? false,
    enableNormalWhiteboard: enableNormalWhiteboard ?? false,
    enableManageParticipants: enableManageParticipants ?? false,
    enableVirtualBackground: enableVirtualBackground ?? false,
    enableNoiseCancellation: enableNoiseCancellation ?? false,
    enableStudentMonitorPiP: enableStudentMonitorPiP ?? false,
  );
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
class RoomFeatures {
  final bool canRecord;
  final bool requireWaitingRoom;
  final bool allowGuestUnmute;
  final bool enablePrivateChat;
  final bool enableScreenAnnotation;
  final bool enableFileSharing;
  final bool enablePdfViewer;
  final bool enableReactions;
  final bool enableRaiseHand;
  final bool enableE2EE;
  final bool enableCollaborativeWhiteboard;
  final bool enableNormalWhiteboard;
  final bool enableManageParticipants;
  final bool enableVirtualBackground;
  final bool enableNoiseCancellation;
  final bool enableStudentMonitorPiP;

  const RoomFeatures({
    this.canRecord = false,
    this.requireWaitingRoom = false,
    this.allowGuestUnmute = false,
    this.enablePrivateChat = false,
    this.enableScreenAnnotation = false,
    this.enableFileSharing = false,
    this.enablePdfViewer = false,
    this.enableReactions = false,
    this.enableRaiseHand = false,
    this.enableE2EE = false,
    this.enableCollaborativeWhiteboard = false,
    this.enableNormalWhiteboard = false,
    this.enableManageParticipants = false,
    this.enableVirtualBackground = false,
    this.enableNoiseCancellation = false,
    this.enableStudentMonitorPiP = false,
  });

  factory RoomFeatures.fromJson(Map<String, dynamic> json) => _$RoomFeaturesFromJson(json);
  Map<String, dynamic> toJson() => _$RoomFeaturesToJson(this);
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
  
  // Get features from room
  RoomFeatures? get features => room?.features;
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
