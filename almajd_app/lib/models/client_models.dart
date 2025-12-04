class ClientRoom {
  final String id;
  final String name;
  final String? description;
  final bool isActive;
  final String hostLink;
  final String guestLink;
  final String? observerLink;
  final int maxParticipants;
  final DateTime createdAt;
  final RoomCounts counts;
  final bool hostApproval;
  final bool canRecord;
  final bool requireWaitingRoom;
  final bool allowGuestUnmute;
  final bool enablePrivateChat;

  ClientRoom({
    required this.id,
    required this.name,
    this.description,
    required this.isActive,
    required this.hostLink,
    required this.guestLink,
    this.observerLink,
    required this.maxParticipants,
    required this.createdAt,
    required this.counts,
    this.hostApproval = false,
    this.canRecord = false,
    this.requireWaitingRoom = false,
    this.allowGuestUnmute = true,
    this.enablePrivateChat = true,
  });

  factory ClientRoom.fromJson(Map<String, dynamic> json) {
    return ClientRoom(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      isActive: json['isActive'] as bool,
      hostLink: json['hostLink'] as String,
      guestLink: json['guestLink'] as String,
      observerLink: json['observerLink'] as String?,
      maxParticipants: json['maxParticipants'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
      counts: json['_count'] != null
          ? RoomCounts.fromJson(json['_count'] as Map<String, dynamic>)
          : RoomCounts(participants: 0, files: 0),
      hostApproval: json['hostApproval'] as bool? ?? false,
      canRecord: json['canRecord'] as bool? ?? false,
      requireWaitingRoom: json['requireWaitingRoom'] as bool? ?? false,
      allowGuestUnmute: json['allowGuestUnmute'] as bool? ?? true,
      enablePrivateChat: json['enablePrivateChat'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'isActive': isActive,
      'hostLink': hostLink,
      'guestLink': guestLink,
      'observerLink': observerLink,
      'maxParticipants': maxParticipants,
      'createdAt': createdAt.toIso8601String(),
      '_count': counts.toJson(),
      'hostApproval': hostApproval,
      'canRecord': canRecord,
      'requireWaitingRoom': requireWaitingRoom,
      'allowGuestUnmute': allowGuestUnmute,
      'enablePrivateChat': enablePrivateChat,
    };
  }
}

class RoomCounts {
  final int participants;
  final int files;

  RoomCounts({
    required this.participants,
    required this.files,
  });

  factory RoomCounts.fromJson(Map<String, dynamic> json) {
    return RoomCounts(
      participants: json['participants'] as int? ?? 0,
      files: json['files'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'participants': participants,
      'files': files,
    };
  }
}

class ClientSubscription {
  final String status; // 'ACTIVE' | 'INACTIVE' | 'EXPIRED'
  final SubscriptionPlan? plan;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  ClientSubscription({
    required this.status,
    this.plan,
    this.createdAt,
    this.updatedAt,
  });

  factory ClientSubscription.fromJson(Map<String, dynamic> json) {
    return ClientSubscription(
      status: json['status'] as String,
      plan: json['plan'] != null
          ? SubscriptionPlan.fromJson(json['plan'] as Map<String, dynamic>)
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'status': status,
      'plan': plan?.toJson(),
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}

class SubscriptionPlan {
  final String name;
  final String? description;
  final List<PlanFeature> features;

  SubscriptionPlan({
    required this.name,
    this.description,
    required this.features,
  });

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) {
    return SubscriptionPlan(
      name: json['name'] as String,
      description: json['description'] as String?,
      features: (json['features'] as List<dynamic>?)
              ?.map((f) => PlanFeature.fromJson(f as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'description': description,
      'features': features.map((f) => f.toJson()).toList(),
    };
  }
}

class PlanFeature {
  final String feature;
  final bool enabled;

  PlanFeature({
    required this.feature,
    required this.enabled,
  });

  factory PlanFeature.fromJson(Map<String, dynamic> json) {
    return PlanFeature(
      feature: json['feature'] as String,
      enabled: json['enabled'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'feature': feature,
      'enabled': enabled,
    };
  }
}

class ClientLimits {
  final String name;
  final String email;
  final int maxRooms;
  final int currentRooms;
  final int maxParticipants;

  ClientLimits({
    required this.name,
    required this.email,
    required this.maxRooms,
    required this.currentRooms,
    required this.maxParticipants,
  });

  factory ClientLimits.fromJson(Map<String, dynamic> json) {
    return ClientLimits(
      name: json['name'] as String,
      email: json['email'] as String,
      maxRooms: json['maxRooms'] as int,
      currentRooms: json['currentRooms'] as int,
      maxParticipants: json['maxParticipants'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'email': email,
      'maxRooms': maxRooms,
      'currentRooms': currentRooms,
      'maxParticipants': maxParticipants,
    };
  }
}

class ClientInfo {
  final String email;
  final String role;
  final String? clientId;

  ClientInfo({
    required this.email,
    required this.role,
    this.clientId,
  });

  factory ClientInfo.fromJson(Map<String, dynamic> json) {
    return ClientInfo(
      email: json['email'] as String,
      role: json['role'] as String,
      clientId: json['clientId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'email': email,
      'role': role,
      'clientId': clientId,
    };
  }
}


