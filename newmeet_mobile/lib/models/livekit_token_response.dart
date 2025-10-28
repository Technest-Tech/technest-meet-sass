class LiveKitTokenResponse {
  final String token;
  final String livekitUrl;
  final String roomName;
  final String participantName;
  final String participantType;

  LiveKitTokenResponse({
    required this.token,
    required this.livekitUrl,
    required this.roomName,
    required this.participantName,
    required this.participantType,
  });

  factory LiveKitTokenResponse.fromJson(Map<String, dynamic> json) {
    return LiveKitTokenResponse(
      token: json['token'] as String,
      livekitUrl: json['livekitUrl'] as String,
      roomName: json['roomName'] as String,
      participantName: json['participantName'] as String,
      participantType: json['participantType'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'token': token,
      'livekitUrl': livekitUrl,
      'roomName': roomName,
      'participantName': participantName,
      'participantType': participantType,
    };
  }
}
