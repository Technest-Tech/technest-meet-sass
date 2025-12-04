import 'package:livekit_client/livekit_client.dart' as lk;

/// Utility functions to filter and detect observer participants
class ObserverFilter {
  /// Check if a participant is an observer
  /// Observers are identified by:
  /// 1. Identity contains '_observer_'
  /// 2. Metadata contains type: 'observer'
  static bool isObserver(dynamic participant) {
    if (participant == null) return false;
    
    String? identity;
    String? metadata;
    
    if (participant is lk.LocalParticipant) {
      identity = participant.identity;
      metadata = participant.metadata;
    } else if (participant is lk.RemoteParticipant) {
      identity = participant.identity;
      metadata = participant.metadata;
    } else {
      return false;
    }
    
    // Check identity for observer pattern
    if (identity != null && identity.contains('_observer_')) {
      return true;
    }
    
    // Check metadata for observer type
    if (metadata != null && metadata.contains('"type":"observer"')) {
      return true;
    }
    
    return false;
  }
  
  /// Filter observers from a list of participants
  static List<T> filterObservers<T>(List<T> participants) {
    return participants.where((participant) => !isObserver(participant)).toList();
  }
  
  /// Count visible (non-observer) participants
  static int countVisibleParticipants(List<dynamic> participants) {
    return participants.where((p) => !isObserver(p)).length;
  }
}

