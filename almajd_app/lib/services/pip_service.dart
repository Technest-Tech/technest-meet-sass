import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

class PipService extends ChangeNotifier {
  static const MethodChannel _channel = MethodChannel('com.academiqmeet.pip');
  
  bool _isPipMode = false;
  bool _isPipAvailable = false;
  bool _isPipSupported = false;
  
  bool get isPipMode => _isPipMode;
  bool get isPipAvailable => _isPipAvailable;
  bool get isPipSupported => _isPipSupported;
  
  PipService() {
    _initialize();
  }
  
  Future<void> _initialize() async {
    try {
      // Check if PiP is supported on the platform
      if (defaultTargetPlatform == TargetPlatform.android) {
        _isPipSupported = true;
        _isPipAvailable = await _channel.invokeMethod<bool>('isPipSupported') ?? false;
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        // iOS PiP support is more limited, but we can still enable background audio
        _isPipSupported = false; // iOS requires AVPlayerViewController for native PiP
        _isPipAvailable = false;
      } else {
        _isPipSupported = false;
        _isPipAvailable = false;
      }
      
      // Set up method call handler for PiP state changes from native
      _channel.setMethodCallHandler(_handleMethodCall);
      
      notifyListeners();
    } catch (e) {
      debugPrint('❌ PipService: Error initializing: $e');
      _isPipSupported = false;
      _isPipAvailable = false;
    }
  }
  
  Future<dynamic> _handleMethodCall(MethodCall call) async {
    switch (call.method) {
      case 'onPipModeChanged':
        final bool isInPip = call.arguments as bool;
        _isPipMode = isInPip;
        notifyListeners();
        debugPrint('🖼️ PipService: PiP mode changed to: $isInPip');
        break;
      default:
        debugPrint('⚠️ PipService: Unknown method call: ${call.method}');
    }
  }
  
  /// Enter Picture-in-Picture mode
  Future<bool> enterPipMode() async {
    if (!_isPipSupported || !_isPipAvailable) {
      debugPrint('⚠️ PipService: PiP is not available on this device');
      return false;
    }
    
    try {
      // Enable wake lock to keep screen on during PiP
      await WakelockPlus.enable();
      
      final bool result = await _channel.invokeMethod<bool>('enterPipMode') ?? false;
      
      if (result) {
        _isPipMode = true;
        notifyListeners();
        debugPrint('✅ PipService: Entered PiP mode');
      } else {
        debugPrint('❌ PipService: Failed to enter PiP mode');
      }
      
      return result;
    } catch (e) {
      debugPrint('❌ PipService: Error entering PiP mode: $e');
      return false;
    }
  }
  
  /// Exit Picture-in-Picture mode
  Future<bool> exitPipMode() async {
    if (!_isPipMode) {
      return true;
    }
    
    try {
      final bool result = await _channel.invokeMethod<bool>('exitPipMode') ?? false;
      
      if (result) {
        _isPipMode = false;
        // Disable wake lock when exiting PiP
        await WakelockPlus.disable();
        notifyListeners();
        debugPrint('✅ PipService: Exited PiP mode');
      } else {
        debugPrint('❌ PipService: Failed to exit PiP mode');
      }
      
      return result;
    } catch (e) {
      debugPrint('❌ PipService: Error exiting PiP mode: $e');
      return false;
    }
  }
  
  /// Check if PiP is currently active
  Future<bool> isInPipMode() async {
    if (!_isPipSupported) {
      return false;
    }
    
    try {
      final bool result = await _channel.invokeMethod<bool>('isInPipMode') ?? false;
      _isPipMode = result;
      notifyListeners();
      return result;
    } catch (e) {
      debugPrint('❌ PipService: Error checking PiP mode: $e');
      return false;
    }
  }
  
  /// Enable background audio/video for iOS (when PiP is not available)
  Future<void> enableBackgroundMode() async {
    try {
      await WakelockPlus.enable();
      debugPrint('✅ PipService: Background mode enabled');
    } catch (e) {
      debugPrint('❌ PipService: Error enabling background mode: $e');
    }
  }
  
  /// Disable background mode
  Future<void> disableBackgroundMode() async {
    try {
      await WakelockPlus.disable();
      debugPrint('✅ PipService: Background mode disabled');
    } catch (e) {
      debugPrint('❌ PipService: Error disabling background mode: $e');
    }
  }
  
  @override
  void dispose() {
    WakelockPlus.disable();
    super.dispose();
  }
}

