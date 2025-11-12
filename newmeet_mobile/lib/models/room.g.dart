// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'room.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoomModel _$RoomModelFromJson(Map<String, dynamic> json) => RoomModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      hostApproval: json['hostApproval'] as bool,
      maxParticipants: (json['maxParticipants'] as num?)?.toInt(),
      isActive: json['isActive'] as bool,
      createdAt: json['createdAt'] as String?,
      hostLink: json['hostLink'] as String?,
      guestLink: json['guestLink'] as String?,
      participants: (json['participants'] as List<dynamic>?)
          ?.map((e) => Participant.fromJson(e as Map<String, dynamic>))
          .toList(),
      canRecord: json['canRecord'] as bool?,
      requireWaitingRoom: json['requireWaitingRoom'] as bool?,
      allowGuestUnmute: json['allowGuestUnmute'] as bool?,
      enablePrivateChat: json['enablePrivateChat'] as bool?,
      enableScreenAnnotation: json['enableScreenAnnotation'] as bool?,
      enableFileSharing: json['enableFileSharing'] as bool?,
      enablePdfViewer: json['enablePdfViewer'] as bool?,
      enableReactions: json['enableReactions'] as bool?,
      enableRaiseHand: json['enableRaiseHand'] as bool?,
      enableE2EE: json['enableE2EE'] as bool?,
      enableCollaborativeWhiteboard:
          json['enableCollaborativeWhiteboard'] as bool?,
      enableNormalWhiteboard: json['enableNormalWhiteboard'] as bool?,
      enableManageParticipants: json['enableManageParticipants'] as bool?,
      enableVirtualBackground: json['enableVirtualBackground'] as bool?,
      enableNoiseCancellation: json['enableNoiseCancellation'] as bool?,
      enableStudentMonitorPiP: json['enableStudentMonitorPiP'] as bool?,
      passwordRequired: json['passwordRequired'] as bool?,
      passwordFor: json['passwordFor'] as String?,
    );

Map<String, dynamic> _$RoomModelToJson(RoomModel instance) => <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'description': instance.description,
      'hostApproval': instance.hostApproval,
      'maxParticipants': instance.maxParticipants,
      'isActive': instance.isActive,
      'createdAt': instance.createdAt,
      'hostLink': instance.hostLink,
      'guestLink': instance.guestLink,
      'participants': instance.participants,
      'canRecord': instance.canRecord,
      'requireWaitingRoom': instance.requireWaitingRoom,
      'allowGuestUnmute': instance.allowGuestUnmute,
      'enablePrivateChat': instance.enablePrivateChat,
      'enableScreenAnnotation': instance.enableScreenAnnotation,
      'enableFileSharing': instance.enableFileSharing,
      'enablePdfViewer': instance.enablePdfViewer,
      'enableReactions': instance.enableReactions,
      'enableRaiseHand': instance.enableRaiseHand,
      'enableE2EE': instance.enableE2EE,
      'enableCollaborativeWhiteboard': instance.enableCollaborativeWhiteboard,
      'enableNormalWhiteboard': instance.enableNormalWhiteboard,
      'enableManageParticipants': instance.enableManageParticipants,
      'enableVirtualBackground': instance.enableVirtualBackground,
      'enableNoiseCancellation': instance.enableNoiseCancellation,
      'enableStudentMonitorPiP': instance.enableStudentMonitorPiP,
      'passwordRequired': instance.passwordRequired,
      'passwordFor': instance.passwordFor,
    };

Participant _$ParticipantFromJson(Map<String, dynamic> json) => Participant(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String,
    );

Map<String, dynamic> _$ParticipantToJson(Participant instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'type': instance.type,
    };

RoomFeatures _$RoomFeaturesFromJson(Map<String, dynamic> json) => RoomFeatures(
      canRecord: json['canRecord'] as bool? ?? false,
      requireWaitingRoom: json['requireWaitingRoom'] as bool? ?? false,
      allowGuestUnmute: json['allowGuestUnmute'] as bool? ?? false,
      enablePrivateChat: json['enablePrivateChat'] as bool? ?? false,
      enableScreenAnnotation: json['enableScreenAnnotation'] as bool? ?? false,
      enableFileSharing: json['enableFileSharing'] as bool? ?? false,
      enablePdfViewer: json['enablePdfViewer'] as bool? ?? false,
      enableReactions: json['enableReactions'] as bool? ?? false,
      enableRaiseHand: json['enableRaiseHand'] as bool? ?? false,
      enableE2EE: json['enableE2EE'] as bool? ?? false,
      enableCollaborativeWhiteboard:
          json['enableCollaborativeWhiteboard'] as bool? ?? false,
      enableNormalWhiteboard: json['enableNormalWhiteboard'] as bool? ?? false,
      enableManageParticipants:
          json['enableManageParticipants'] as bool? ?? false,
      enableVirtualBackground:
          json['enableVirtualBackground'] as bool? ?? false,
      enableNoiseCancellation:
          json['enableNoiseCancellation'] as bool? ?? false,
      enableStudentMonitorPiP:
          json['enableStudentMonitorPiP'] as bool? ?? false,
    );

Map<String, dynamic> _$RoomFeaturesToJson(RoomFeatures instance) =>
    <String, dynamic>{
      'canRecord': instance.canRecord,
      'requireWaitingRoom': instance.requireWaitingRoom,
      'allowGuestUnmute': instance.allowGuestUnmute,
      'enablePrivateChat': instance.enablePrivateChat,
      'enableScreenAnnotation': instance.enableScreenAnnotation,
      'enableFileSharing': instance.enableFileSharing,
      'enablePdfViewer': instance.enablePdfViewer,
      'enableReactions': instance.enableReactions,
      'enableRaiseHand': instance.enableRaiseHand,
      'enableE2EE': instance.enableE2EE,
      'enableCollaborativeWhiteboard': instance.enableCollaborativeWhiteboard,
      'enableNormalWhiteboard': instance.enableNormalWhiteboard,
      'enableManageParticipants': instance.enableManageParticipants,
      'enableVirtualBackground': instance.enableVirtualBackground,
      'enableNoiseCancellation': instance.enableNoiseCancellation,
      'enableStudentMonitorPiP': instance.enableStudentMonitorPiP,
    };

RoomValidation _$RoomValidationFromJson(Map<String, dynamic> json) =>
    RoomValidation(
      exists: json['exists'] as bool,
      room: json['room'] == null
          ? null
          : RoomModel.fromJson(json['room'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$RoomValidationToJson(RoomValidation instance) =>
    <String, dynamic>{
      'exists': instance.exists,
      'room': instance.room,
    };

LiveKitTokenResponse _$LiveKitTokenResponseFromJson(
        Map<String, dynamic> json) =>
    LiveKitTokenResponse(
      token: json['token'] as String,
      livekitUrl: json['livekitUrl'] as String,
      roomName: json['roomName'] as String,
      participantName: json['participantName'] as String,
      participantType: json['participantType'] as String,
    );

Map<String, dynamic> _$LiveKitTokenResponseToJson(
        LiveKitTokenResponse instance) =>
    <String, dynamic>{
      'token': instance.token,
      'livekitUrl': instance.livekitUrl,
      'roomName': instance.roomName,
      'participantName': instance.participantName,
      'participantType': instance.participantType,
    };
