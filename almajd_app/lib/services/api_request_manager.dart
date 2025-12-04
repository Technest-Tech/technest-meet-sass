import 'package:dio/dio.dart';
import '../utils/logger.dart';

/// Manages active API requests and provides cancellation support
class ApiRequestManager {
  static final ApiRequestManager _instance = ApiRequestManager._internal();
  factory ApiRequestManager() => _instance;
  ApiRequestManager._internal();

  final Map<String, CancelToken> _activeTokens = {};

  /// Create a cancel token for a request
  CancelToken createToken(String requestId) {
    final token = CancelToken();
    _activeTokens[requestId] = token;
    Logger.debug('Created cancel token for request: $requestId', 'ApiRequestManager');
    return token;
  }

  /// Cancel a specific request
  void cancelRequest(String requestId) {
    final token = _activeTokens[requestId];
    if (token != null && !token.isCancelled) {
      token.cancel('Request cancelled');
      Logger.debug('Cancelled request: $requestId', 'ApiRequestManager');
    }
    _activeTokens.remove(requestId);
  }

  /// Cancel all active requests
  void cancelAllRequests() {
    Logger.debug('Cancelling all active requests (${_activeTokens.length})', 'ApiRequestManager');
    for (final entry in _activeTokens.entries) {
      if (!entry.value.isCancelled) {
        entry.value.cancel('All requests cancelled');
      }
    }
    _activeTokens.clear();
  }

  /// Remove a token (called after request completes)
  void removeToken(String requestId) {
    _activeTokens.remove(requestId);
  }

  /// Get count of active requests
  int get activeRequestCount => _activeTokens.length;
}

