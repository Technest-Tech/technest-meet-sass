import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import '../config/app_config.dart';
import '../models/client_models.dart';
import '../utils/logger.dart';
import 'http_client_service.dart';

class AuthService {
  static const String _prefIsLoggedIn = 'isClientLoggedIn';
  static const String _prefClientEmail = 'clientEmail';
  static const String _prefClientId = 'clientId';

  static String get baseUrl => AppConfig.baseUrl;

  /// Login with email and password
  static Future<ClientInfo> login(String email, String password) async {
    try {
      Logger.debug(' Attempting login for $email', 'AuthService');

      final dio = await HttpClientService.dio;
      final response = await dio.post(
        '/api/auth/login',
        data: {
          'email': email,
          'password': password,
          'role': 'CLIENT',
        },
      );

      Logger.debug(' Login response - Status: ${response.statusCode}', 'AuthService');
      Logger.debug(' Login response - Body: ${response.data}', 'AuthService');

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final user = data['user'] as Map<String, dynamic>;
        final clientInfo = ClientInfo.fromJson(user);

        // Save auth state to shared preferences
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool(_prefIsLoggedIn, true);
        await prefs.setString(_prefClientEmail, clientInfo.email);
        if (clientInfo.clientId != null) {
          await prefs.setString(_prefClientId, clientInfo.clientId!);
        }

        Logger.debug(' Login successful for ${clientInfo.email}', 'AuthService');
        return clientInfo;
      } else {
        final error = (response.data as Map<String, dynamic>?)?['error'] as String? ?? 'Login failed';
        Logger.error('Login failed - $error', null, null, 'AuthService');
        throw Exception(error);
      }
    } on DioException catch (e) {
      Logger.error('Login error: $e', null, null, 'AuthService');
      final error = e.response?.data?['error'] as String? ?? 'Login failed';
      throw Exception(error);
    } catch (e) {
      Logger.error('Login error: $e', null, null, 'AuthService');
      if (e is Exception) {
        rethrow;
      }
      throw Exception('Error during login: $e');
    }
  }

  /// Logout and clear session
  static Future<void> logout() async {
    try {
      Logger.debug(' Attempting logout', 'AuthService');

      // Call logout API
      final dio = await HttpClientService.dio;
      await dio.post('/api/auth/logout');

      Logger.debug(' Logout API call successful', 'AuthService');
    } catch (e) {
      Logger.warning(' Logout API error (clearing local state anyway): $e', 'AuthService');
    } finally {
      // Clear cookies
      await HttpClientService.clearCookies();
      
      // Clear shared preferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_prefIsLoggedIn);
      await prefs.remove(_prefClientEmail);
      await prefs.remove(_prefClientId);

      Logger.debug(' Logout complete - cookies and local state cleared', 'AuthService');
    }
  }

  /// Get current client info from server
  static Future<ClientInfo?> getClientInfo() async {
    try {
      Logger.debug(' Getting client info', 'AuthService');

      final dio = await HttpClientService.dio;
      final response = await dio.get('/api/auth/me');

      Logger.debug(' Get client info response - Status: ${response.statusCode}', 'AuthService');

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final clientInfo = ClientInfo.fromJson(data);

        // Update shared preferences
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool(_prefIsLoggedIn, true);
        await prefs.setString(_prefClientEmail, clientInfo.email);
        if (clientInfo.clientId != null) {
          await prefs.setString(_prefClientId, clientInfo.clientId!);
        }

        Logger.debug(' Client info retrieved for ${clientInfo.email}', 'AuthService');
        return clientInfo;
      } else {
        Logger.error('Get client info failed', null, null, 'AuthService');
        // Clear local state if session is invalid
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(_prefIsLoggedIn);
        await prefs.remove(_prefClientEmail);
        await prefs.remove(_prefClientId);
        return null;
      }
    } on DioException catch (e) {
      Logger.error('Get client info error: $e', null, null, 'AuthService');
      if (e.response?.statusCode == 401) {
        // Session invalid, clear local state
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(_prefIsLoggedIn);
        await prefs.remove(_prefClientEmail);
        await prefs.remove(_prefClientId);
        await HttpClientService.clearCookies();
      }
      return null;
    } catch (e) {
      Logger.error('Get client info error: $e', null, null, 'AuthService');
      return null;
    }
  }

  /// Check if user is logged in (from shared preferences)
  static Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_prefIsLoggedIn) ?? false;
  }

  /// Get stored client email
  static Future<String?> getStoredEmail() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_prefClientEmail);
  }

  /// Get stored client ID
  static Future<String?> getStoredClientId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_prefClientId);
  }

  /// Clear all auth data (for logout)
  static Future<void> clearAuthData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefIsLoggedIn);
    await prefs.remove(_prefClientEmail);
    await prefs.remove(_prefClientId);
  }
}


