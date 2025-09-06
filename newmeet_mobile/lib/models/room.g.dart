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
