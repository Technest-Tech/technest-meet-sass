class Room {
  final String id;
  final String name;
  final String? description;
  final bool hostApproval;
  final int maxParticipants;
  final bool isActive;
  final bool canRecord;
  final String hostLink;
  final String guestLink;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final List<Participant> participants;

  Room({
    required this.id,
    required this.name,
    this.description,
    required this.hostApproval,
    required this.maxParticipants,
    required this.isActive,
    required this.canRecord,
    required this.hostLink,
    required this.guestLink,
    required this.createdAt,
    this.updatedAt,
    required this.participants,
  });

  factory Room.fromJson(Map<String, dynamic> json) {
    return Room(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      hostApproval: json['hostApproval'] as bool? ?? false,
      maxParticipants: json['maxParticipants'] as int? ?? 50,
      isActive: json['isActive'] as bool? ?? true,
      canRecord: json['canRecord'] as bool? ?? false,
      hostLink: json['hostLink'] as String? ?? json['name'] as String,
      guestLink: json['guestLink'] as String? ?? json['name'] as String,
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null 
          ? DateTime.parse(json['updatedAt'] as String) 
          : null,
      participants: (json['participants'] as List<dynamic>?)
          ?.map((p) => Participant.fromJson(p as Map<String, dynamic>))
          .toList() ?? [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'hostApproval': hostApproval,
      'maxParticipants': maxParticipants,
      'isActive': isActive,
      'canRecord': canRecord,
      'hostLink': hostLink,
      'guestLink': guestLink,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
      'participants': participants.map((p) => p.toJson()).toList(),
    };
  }

  Room copyWith({
    String? id,
    String? name,
    String? description,
    bool? hostApproval,
    int? maxParticipants,
    bool? isActive,
    bool? canRecord,
    String? hostLink,
    String? guestLink,
    DateTime? createdAt,
    DateTime? updatedAt,
    List<Participant>? participants,
  }) {
    return Room(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      hostApproval: hostApproval ?? this.hostApproval,
      maxParticipants: maxParticipants ?? this.maxParticipants,
      isActive: isActive ?? this.isActive,
      canRecord: canRecord ?? this.canRecord,
      hostLink: hostLink ?? this.hostLink,
      guestLink: guestLink ?? this.guestLink,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      participants: participants ?? this.participants,
    );
  }
}

class Participant {
  final String id;
  final String name;
  final String type; // 'HOST' or 'GUEST'
  final String roomId;

  Participant({
    required this.id,
    required this.name,
    required this.type,
    required this.roomId,
  });

  factory Participant.fromJson(Map<String, dynamic> json) {
    return Participant(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String,
      roomId: json['roomId'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
      'roomId': roomId,
    };
  }
}