import 'package:flutter/foundation.dart';

/// Logger utility to replace print statements
/// Automatically disabled in production builds
class Logger {
  static void debug(String message, [String? tag]) {
    if (kDebugMode) {
      final prefix = tag != null ? '[$tag]' : '[DEBUG]';
      debugPrint('$prefix $message');
    }
  }

  static void info(String message, [String? tag]) {
    if (kDebugMode) {
      final prefix = tag != null ? '[$tag]' : '[INFO]';
      debugPrint('$prefix $message');
    }
  }

  static void warning(String message, [String? tag]) {
    if (kDebugMode) {
      final prefix = tag != null ? '[$tag]' : '[WARNING]';
      debugPrint('$prefix $message');
    }
  }

  static void error(String message, [Object? error, StackTrace? stackTrace, String? tag]) {
    if (kDebugMode) {
      final prefix = tag != null ? '[$tag]' : '[ERROR]';
      debugPrint('$prefix $message');
      if (error != null) {
        debugPrint('$prefix Error: $error');
      }
      if (stackTrace != null) {
        debugPrint('$prefix StackTrace: $stackTrace');
      }
    }
  }
}



















