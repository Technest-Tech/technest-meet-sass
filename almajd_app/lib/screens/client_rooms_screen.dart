import 'package:flutter/material.dart';
import '../utils/logger.dart';
import '../services/api_service.dart';
import '../utils/logger.dart';
import '../models/client_models.dart';
import '../utils/logger.dart';
import '../widgets/client/room_card.dart';
import '../utils/logger.dart';
import '../widgets/client/create_room_dialog.dart';
import '../utils/logger.dart';
import '../widgets/client/client_button.dart';
import '../utils/logger.dart';

class ClientRoomsScreen extends StatefulWidget {
  final VoidCallback? onRoomCreated;

  const ClientRoomsScreen({
    super.key,
    this.onRoomCreated,
  });

  @override
  State<ClientRoomsScreen> createState() => _ClientRoomsScreenState();
}

class _ClientRoomsScreenState extends State<ClientRoomsScreen> {
  List<ClientRoom> _rooms = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRooms();
  }

  Future<void> _loadRooms() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final rooms = await ApiService.getClientRooms();
      setState(() {
        _rooms = rooms;
        _isLoading = false;
      });
      if (widget.onRoomCreated != null) {
        widget.onRoomCreated!();
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _handleCreateRoom() async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => const CreateRoomDialog(),
    );

    if (result != null) {
      try {
        setState(() {
          _isLoading = true;
        });

        await ApiService.createClientRoom(result);
        await _loadRooms();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Room created successfully'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to create room: ${e.toString()}'),
              backgroundColor: Colors.red,
            ),
          );
        }
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleEditRoom(ClientRoom room) async {
    // Fetch full room details first
    if (!mounted) return;
    
    try {
      final fullRoom = await ApiService.getClientRoom(room.id);
      
      if (!mounted) return;
      
      final result = await showDialog<Map<String, dynamic>>(
        context: context,
        builder: (context) => CreateRoomDialog(
          isEdit: true,
          roomName: fullRoom.name,
          description: fullRoom.description,
          hostApproval: fullRoom.hostApproval,
          canRecord: fullRoom.canRecord,
          requireWaitingRoom: fullRoom.requireWaitingRoom,
          allowGuestUnmute: fullRoom.allowGuestUnmute,
          enablePrivateChat: fullRoom.enablePrivateChat,
        ),
      );

      if (result != null) {
        try {
          setState(() {
            _isLoading = true;
          });

          await ApiService.updateClientRoom(room.id, result);
          await _loadRooms();

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Room updated successfully'),
                backgroundColor: Colors.green,
              ),
            );
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Failed to update room: ${e.toString()}'),
                backgroundColor: Colors.red,
              ),
            );
          }
          setState(() {
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load room details: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _handleDeleteRoom(ClientRoom room) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Room'),
        content: Text('Are you sure you want to delete "${room.name}"? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        setState(() {
          _isLoading = true;
        });

        await ApiService.deleteClientRoom(room.id);
        await _loadRooms();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Room deleted successfully'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to delete room: ${e.toString()}'),
              backgroundColor: Colors.red,
            ),
          );
        }
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: _isLoading && _rooms.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _rooms.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
                      const SizedBox(height: 16),
                      Text(
                        'Error loading rooms',
                        style: TextStyle(fontSize: 18, color: Colors.grey[800]),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _error!,
                        style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      ClientButton(
                        text: 'Retry',
                        onPressed: _loadRooms,
                        icon: Icons.refresh,
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadRooms,
                  child: _rooms.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.meeting_room_outlined,
                                  size: 64, color: Colors.grey[400]),
                              const SizedBox(height: 16),
                              Text(
                                'No rooms yet',
                                style: TextStyle(
                                  fontSize: 18,
                                  color: Colors.grey[800],
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Create your first room to get started',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey[600],
                                ),
                              ),
                              const SizedBox(height: 24),
                              ClientButton(
                                text: 'Create Room',
                                onPressed: _handleCreateRoom,
                                icon: Icons.add,
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _rooms.length,
                          itemBuilder: (context, index) {
                            final room = _rooms[index];
                            return RoomCard(
                              room: room,
                              onEdit: () => _handleEditRoom(room),
                              onDelete: () => _handleDeleteRoom(room),
                            );
                          },
                        ),
                ),
      floatingActionButton: _rooms.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: _handleCreateRoom,
              backgroundColor: const Color(0xFF1C7ED6),
              icon: const Icon(Icons.add),
              label: const Text('Create Room'),
            )
          : null,
    );
  }
}


