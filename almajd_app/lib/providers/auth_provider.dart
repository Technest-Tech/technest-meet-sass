import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';
import '../models/client_models.dart';
import '../utils/logger.dart';

class AuthProvider with ChangeNotifier {
  bool _isLoggedIn = false;
  bool _isLoading = false;
  ClientInfo? _clientInfo;
  String? _error;

  bool get isLoggedIn => _isLoggedIn;
  bool get isLoading => _isLoading;
  ClientInfo? get clientInfo => _clientInfo;
  String? get error => _error;
  String? get email => _clientInfo?.email;
  String? get clientId => _clientInfo?.clientId;

  AuthProvider() {
    _checkAuthState();
  }

  /// Check authentication state on initialization
  Future<void> _checkAuthState() async {
    _isLoading = true;
    notifyListeners();

    try {
      final isLoggedIn = await AuthService.isLoggedIn();
      if (isLoggedIn) {
        // Try to get client info from server to verify session
        final clientInfo = await AuthService.getClientInfo();
        if (clientInfo != null) {
          _clientInfo = clientInfo;
          _isLoggedIn = true;
        } else {
          // Session invalid, clear local state
          _isLoggedIn = false;
          _clientInfo = null;
          await AuthService.clearAuthData();
        }
      } else {
        _isLoggedIn = false;
        _clientInfo = null;
      }
      _error = null;
    } catch (e) {
      Logger.error('Error checking auth state: $e', e, null, 'AuthProvider');
      _error = e.toString();
      _isLoggedIn = false;
      _clientInfo = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Login with email and password
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final clientInfo = await AuthService.login(email, password);
      _clientInfo = clientInfo;
      _isLoggedIn = true;
      _error = null;
      notifyListeners();
      return true;
    } catch (e) {
      Logger.error('Login error: $e', e, null, 'AuthProvider');
      _error = e.toString();
      _isLoggedIn = false;
      _clientInfo = null;
      notifyListeners();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Logout
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await AuthService.logout();
      _isLoggedIn = false;
      _clientInfo = null;
      _error = null;
    } catch (e) {
      Logger.error('Logout error: $e', e, null, 'AuthProvider');
      _error = e.toString();
      // Clear local state anyway
      _isLoggedIn = false;
      _clientInfo = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refresh client info from server
  Future<void> refreshClientInfo() async {
    try {
      final clientInfo = await AuthService.getClientInfo();
      if (clientInfo != null) {
        _clientInfo = clientInfo;
        _isLoggedIn = true;
        notifyListeners();
      } else {
        // Session invalid
        _isLoggedIn = false;
        _clientInfo = null;
        await AuthService.clearAuthData();
        notifyListeners();
      }
    } catch (e) {
      Logger.error('Refresh error: $e', e, null, 'AuthProvider');
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}


