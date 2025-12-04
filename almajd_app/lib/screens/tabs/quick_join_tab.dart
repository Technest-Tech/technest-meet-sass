import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../services/api_service.dart';
import '../../services/room_storage_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/error_handler.dart';
import '../video_conference_screen.dart';

class QuickJoinTab extends StatefulWidget {
  const QuickJoinTab({super.key});

  @override
  State<QuickJoinTab> createState() => _QuickJoinTabState();
}

class _QuickJoinTabState extends State<QuickJoinTab> with AutomaticKeepAliveClientMixin {
  List<StoredRoom> _favoriteRooms = [];
  bool _isLoading = true;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadFavoriteRooms();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Refresh when tab becomes visible
    _loadFavoriteRooms();
  }

  Future<void> _loadFavoriteRooms() async {
    setState(() {
      _isLoading = true;
    });

    final rooms = await RoomStorageService.getFavoriteRooms();
    setState(() {
      _favoriteRooms = rooms;
      _isLoading = false;
    });
  }

  Future<void> _joinRoom(StoredRoom room) async {
    try {
      // Request permissions
      await _requestPermissions();

      // Validate room exists
      final validation = await ApiService.validateRoom(room.roomName, room.participantType);

      if (!validation.exists) {
        if (mounted) {
          ErrorHandler.handleError(
            context,
            'Room not found',
            userMessage: 'Room "${room.roomName}" no longer exists.',
          );
        }
        // Remove invalid room from history
        await RoomStorageService.deleteRoom(room.roomName);
        _loadFavoriteRooms();
        return;
      }

      if (validation.room != null && !validation.room!.isActive) {
        if (mounted) {
          ErrorHandler.handleError(
            context,
            'Room inactive',
            userMessage: 'This room is currently inactive.',
          );
        }
        return;
      }

      // Update last accessed time
      await RoomStorageService.saveRoom(
        roomName: room.roomName,
        roomId: room.roomId,
        participantName: room.participantName,
        participantType: room.participantType,
      );

      // Extract features from validation
      final features = validation.features;

      // Navigate to video conference
      if (mounted) {
        await Navigator.push(
          context,
          PageRouteBuilder(
            pageBuilder: (context, animation, secondaryAnimation) =>
                VideoConferenceScreen(
              roomName: room.roomName,
              participantName: room.participantName ?? (room.participantType == 'host' ? 'Host' : 'Guest'),
              participantType: room.participantType,
              roomFeatures: features,
            ),
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              return FadeTransition(
                opacity: animation,
                child: child,
              );
            },
          ),
        );
        _loadFavoriteRooms();
      }
    } catch (e) {
      ErrorHandler.handleError(context, e);
    }
  }

  Future<void> _requestPermissions() async {
    final permissions = [
      Permission.camera,
      Permission.microphone,
    ];

    for (final permission in permissions) {
      final status = await permission.status;

      if (status.isDenied) {
        final requestResult = await permission.request();
        if (!requestResult.isGranted) {
          throw Exception(
              'Permission denied: ${permission.toString().split('.').last}. Please enable camera and microphone permissions in your device settings.');
        }
      } else if (status.isPermanentlyDenied) {
        throw Exception(
            'Permission permanently denied: ${permission.toString().split('.').last}. Please enable camera and microphone permissions in your device settings.');
      } else if (!status.isGranted) {
        throw Exception(
            'Permission not granted: ${permission.toString().split('.').last}. Please enable camera and microphone permissions in your device settings.');
      }
    }
  }

  Future<void> _toggleFavorite(StoredRoom room) async {
    await RoomStorageService.toggleFavorite(room.roomName);
    _loadFavoriteRooms();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // Required for AutomaticKeepAliveClientMixin
    return RefreshIndicator(
      onRefresh: _loadFavoriteRooms,
      child: CustomScrollView(
        slivers: [
          // Header
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(AppTheme.spacingL),
              child: Container(
                padding: const EdgeInsets.all(AppTheme.spacingXL),
                decoration: AppTheme.glassmorphism(
                  color: Colors.white,
                  opacity: 0.15,
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(AppTheme.spacingL),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.star,
                        size: 48,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacingM),
                    const Text(
                      'Favorite Rooms',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppTheme.spacingS),
                    Text(
                      'Quick access to your favorite meetings',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white.withOpacity(0.9),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    if (_favoriteRooms.isNotEmpty) ...[
                      const SizedBox(height: AppTheme.spacingM),
                      Text(
                        '${_favoriteRooms.length} ${_favoriteRooms.length == 1 ? 'favorite' : 'favorites'}',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.8),
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),

          // Favorite Rooms List
          if (_isLoading)
            const SliverFillRemaining(
              child: Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              ),
            )
          else if (_favoriteRooms.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(AppTheme.spacingXL),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.star_border,
                        size: 64,
                        color: Colors.white.withOpacity(0.5),
                      ),
                      const SizedBox(height: AppTheme.spacingL),
                      Text(
                        'No favorite rooms',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withOpacity(0.9),
                        ),
                      ),
                      const SizedBox(height: AppTheme.spacingS),
                      Text(
                        'Star rooms in Recent tab to add them here',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white.withOpacity(0.7),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final room = _favoriteRooms[index];
                  return _buildFavoriteRoomCard(room);
                },
                childCount: _favoriteRooms.length,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildFavoriteRoomCard(StoredRoom room) {
    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingL,
        vertical: AppTheme.spacingS,
      ),
      decoration: AppTheme.glassmorphism(
        color: Colors.white,
        opacity: 0.2,
        blur: 20.0,
      ).copyWith(
        border: Border.all(
          color: AppTheme.warningOrange.withOpacity(0.5),
          width: 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _joinRoom(room),
          borderRadius: BorderRadius.circular(AppTheme.radiusL),
          child: Padding(
            padding: const EdgeInsets.all(AppTheme.spacingM),
            child: Row(
              children: [
                // Star Icon
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppTheme.warningOrange.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(AppTheme.radiusM),
                  ),
                  child: const Icon(
                    Icons.star,
                    color: AppTheme.warningOrange,
                    size: 28,
                  ),
                ),
                const SizedBox(width: AppTheme.spacingM),

                // Room Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              room.roomName,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      if (room.participantName != null)
                        Text(
                          room.participantName!,
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.white.withOpacity(0.7),
                          ),
                        ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: room.participantType == 'host'
                              ? AppTheme.primaryBlueLight.withOpacity(0.3)
                              : Colors.grey.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          room.participantType.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Actions
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      onPressed: () => _joinRoom(room),
                      icon: const Icon(
                        Icons.play_circle_filled,
                        color: AppTheme.successGreen,
                        size: 32,
                      ),
                      tooltip: 'Join',
                    ),
                    IconButton(
                      onPressed: () => _toggleFavorite(room),
                      icon: const Icon(
                        Icons.star,
                        color: AppTheme.warningOrange,
                        size: 24,
                      ),
                      tooltip: 'Remove from favorites',
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

