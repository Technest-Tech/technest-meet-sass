import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../services/api_service.dart';
import '../../services/room_storage_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/error_handler.dart';
import '../video_conference_screen.dart';

class RecentRoomsTab extends StatefulWidget {
  const RecentRoomsTab({super.key});

  @override
  State<RecentRoomsTab> createState() => _RecentRoomsTabState();
}

class _RecentRoomsTabState extends State<RecentRoomsTab> with AutomaticKeepAliveClientMixin {
  List<StoredRoom> _rooms = [];
  List<StoredRoom> _filteredRooms = [];
  bool _isLoading = true;
  final TextEditingController _searchController = TextEditingController();

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadRooms();
    _searchController.addListener(_filterRooms);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Refresh when tab becomes visible
    _loadRooms();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadRooms() async {
    setState(() {
      _isLoading = true;
    });

    final rooms = await RoomStorageService.getRecentRooms();
    setState(() {
      _rooms = rooms;
      _filteredRooms = rooms;
      _isLoading = false;
    });
  }

  void _filterRooms() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      if (query.isEmpty) {
        _filteredRooms = _rooms;
      } else {
        _filteredRooms = _rooms.where((room) {
          return room.roomName.toLowerCase().contains(query) ||
              (room.roomId?.toLowerCase().contains(query) ?? false) ||
              (room.participantName?.toLowerCase().contains(query) ?? false);
        }).toList();
      }
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
        _loadRooms();
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

      // Extract features from validation
      final features = validation.features;

      // Update last accessed time
      await RoomStorageService.saveRoom(
        roomName: room.roomName,
        roomId: room.roomId,
        participantName: room.participantName,
        participantType: room.participantType,
      );

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
        _loadRooms();
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

  Future<void> _deleteRoom(StoredRoom room) async {
    await RoomStorageService.deleteRoom(room.roomName);
    _loadRooms();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Room removed from history'),
          backgroundColor: AppTheme.successGreen,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _clearAllRooms() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text(
          'Clear All Rooms?',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          'Are you sure you want to clear all room history? This action cannot be undone.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorRed,
            ),
            child: const Text('Clear All'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await RoomStorageService.clearHistory();
      _loadRooms();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('All rooms cleared'),
            backgroundColor: AppTheme.successGreen,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays == 0) {
      if (difference.inHours == 0) {
        if (difference.inMinutes == 0) {
          return 'Just now';
        }
        return '${difference.inMinutes}m ago';
      }
      return '${difference.inHours}h ago';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${date.day}/${date.month}/${date.year}';
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // Required for AutomaticKeepAliveClientMixin
    return RefreshIndicator(
      onRefresh: _loadRooms,
      child: CustomScrollView(
        slivers: [
          // Header with Search
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(AppTheme.spacingL),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Container(
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
                            Icons.history,
                            size: 48,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: AppTheme.spacingM),
                        const Text(
                          'Recent Rooms',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: AppTheme.spacingS),
                        Text(
                          'Quick access to your recent meetings',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.white.withOpacity(0.9),
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: AppTheme.spacingL),

                  // Search Bar
                  Container(
                    decoration: AppTheme.glassmorphism(
                      color: Colors.white,
                      opacity: 0.2,
                    ),
                    child: TextField(
                      controller: _searchController,
                      decoration: InputDecoration(
                        hintText: 'Search rooms...',
                        prefixIcon: const Icon(Icons.search, color: Colors.white70),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, color: Colors.white70),
                                onPressed: () {
                                  _searchController.clear();
                                },
                              )
                            : null,
                        filled: true,
                        fillColor: Colors.white.withOpacity(0.1),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppTheme.radiusM),
                          borderSide: BorderSide(color: Colors.white.withOpacity(0.3)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppTheme.radiusM),
                          borderSide: BorderSide(color: Colors.white.withOpacity(0.3)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppTheme.radiusM),
                          borderSide: const BorderSide(color: Colors.white, width: 2),
                        ),
                      ),
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),

                  if (_rooms.isNotEmpty) ...[
                    const SizedBox(height: AppTheme.spacingM),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${_filteredRooms.length} ${_filteredRooms.length == 1 ? 'room' : 'rooms'}',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.8),
                            fontSize: 14,
                          ),
                        ),
                        TextButton(
                          onPressed: _clearAllRooms,
                          child: Text(
                            'Clear All',
                            style: TextStyle(
                              color: AppTheme.errorRed,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Rooms List
          if (_isLoading)
            const SliverFillRemaining(
              child: Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              ),
            )
          else if (_filteredRooms.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(AppTheme.spacingXL),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _rooms.isEmpty ? Icons.history : Icons.search_off,
                        size: 64,
                        color: Colors.white.withOpacity(0.5),
                      ),
                      const SizedBox(height: AppTheme.spacingL),
                      Text(
                        _rooms.isEmpty
                            ? 'No recent rooms'
                            : 'No rooms found',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withOpacity(0.9),
                        ),
                      ),
                      const SizedBox(height: AppTheme.spacingS),
                      Text(
                        _rooms.isEmpty
                            ? 'Join a room to see it here'
                            : 'Try a different search term',
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
                  final room = _filteredRooms[index];
                  return _buildRoomCard(room);
                },
                childCount: _filteredRooms.length,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRoomCard(StoredRoom room) {
    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingL,
        vertical: AppTheme.spacingS,
      ),
      decoration: AppTheme.glassmorphism(
        color: Colors.white,
        opacity: 0.2,
        blur: 20.0,
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
                // Room Icon
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryBlueLight.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(AppTheme.radiusM),
                  ),
                  child: const Icon(
                    Icons.meeting_room,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
                const SizedBox(width: AppTheme.spacingM),

                // Room Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        room.roomName,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
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
                      Row(
                        children: [
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
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const SizedBox(width: AppTheme.spacingS),
                          Text(
                            _formatDate(room.lastAccessed),
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.white.withOpacity(0.6),
                            ),
                          ),
                        ],
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
                      onPressed: () async {
                        await RoomStorageService.toggleFavorite(room.roomName);
                        _loadRooms();
                      },
                      icon: Icon(
                        room.isFavorite ? Icons.star : Icons.star_border,
                        color: room.isFavorite
                            ? AppTheme.warningOrange
                            : Colors.white70,
                        size: 24,
                      ),
                      tooltip: room.isFavorite ? 'Remove from favorites' : 'Add to favorites',
                    ),
                    IconButton(
                      onPressed: () => _deleteRoom(room),
                      icon: const Icon(
                        Icons.delete_outline,
                        color: AppTheme.errorRed,
                        size: 24,
                      ),
                      tooltip: 'Delete',
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

