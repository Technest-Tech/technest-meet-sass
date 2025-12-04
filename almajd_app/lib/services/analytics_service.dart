import 'package:flutter/foundation.dart';
import '../utils/logger.dart';

/// Analytics service for tracking user actions and performance metrics
/// In production, this can be integrated with Firebase Analytics, Mixpanel, etc.
class AnalyticsService {
  static final AnalyticsService _instance = AnalyticsService._internal();
  factory AnalyticsService() => _instance;
  AnalyticsService._internal();

  /// Track a user event
  static void trackEvent(String eventName, {Map<String, dynamic>? parameters}) {
    if (kDebugMode) {
      Logger.info('Event: $eventName${parameters != null ? ' - $parameters' : ''}', 'Analytics');
    }

    // In production, send to analytics service
    if (kReleaseMode) {
      // TODO: Integrate with Firebase Analytics or other service
      // FirebaseAnalytics.instance.logEvent(
      //   name: eventName,
      //   parameters: parameters,
      // );
    }
  }

  /// Track screen view
  static void trackScreenView(String screenName) {
    if (kDebugMode) {
      Logger.debug('Screen view: $screenName', 'Analytics');
    }

    if (kReleaseMode) {
      // TODO: Integrate with analytics service
      // FirebaseAnalytics.instance.logScreenView(screenName: screenName);
    }
  }

  /// Track meeting events
  static void trackMeetingJoined(String roomName, String participantType) {
    trackEvent('meeting_joined', parameters: {
      'room_name': roomName,
      'participant_type': participantType,
    });
  }

  static void trackMeetingLeft(String roomName) {
    trackEvent('meeting_left', parameters: {
      'room_name': roomName,
    });
  }

  /// Track connection quality
  static void trackConnectionQuality(String quality, {String? roomName}) {
    trackEvent('connection_quality', parameters: {
      'quality': quality,
      if (roomName != null) 'room_name': roomName,
    });
  }

  /// Track feature usage
  static void trackFeatureUsage(String featureName, {Map<String, dynamic>? additionalParams}) {
    final params = <String, dynamic>{'feature': featureName};
    if (additionalParams != null) {
      params.addAll(additionalParams);
    }
    trackEvent('feature_used', parameters: params);
  }

  /// Track errors
  static void trackError(String errorType, String errorMessage) {
    trackEvent('error_occurred', parameters: {
      'error_type': errorType,
      'error_message': errorMessage,
    });
  }

  /// Track performance metrics
  static void trackPerformance(String metricName, int value, {String? unit}) {
    trackEvent('performance_metric', parameters: {
      'metric': metricName,
      'value': value,
      if (unit != null) 'unit': unit,
    });
  }
}


