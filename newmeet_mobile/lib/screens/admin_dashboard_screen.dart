import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/admin_auth_service.dart';
import '../services/admin_room_service.dart';
import '../models/room.dart';
import '../widgets/create_room_modal.dart';
import '../widgets/edit_room_modal.dart';
import '../config/app_config.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  List<Room> _rooms = [];
  bool _isLoading = true;
  String _searchTerm = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
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

    try {
      final rooms = await AdminRoomService.getRooms();
      setState(() {
        _rooms = rooms;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      _showErrorSnackBar('Failed to load rooms: $e');
    }
  }

  Future<void> _deleteRoom(String roomId) async {
    final confirmed = await _showConfirmDialog(
      'Delete Room',
      'Are you sure you want to delete this room?',
    );

    if (!confirmed) return;

    try {
      await AdminRoomService.deleteRoom(roomId);
      setState(() {
        _rooms.removeWhere((room) => room.id == roomId);
      });
      _showSuccessSnackBar('Room deleted successfully');
    } catch (e) {
      _showErrorSnackBar('Failed to delete room: $e');
    }
  }

  Future<void> _createRoom() async {
    final result = await showDialog<Room>(
      context: context,
      builder: (context) => const CreateRoomModal(),
    );

    if (result != null) {
      setState(() {
        _rooms.insert(0, result);
      });
      _showSuccessSnackBar('Room created successfully');
    }
  }

  Future<void> _editRoom(Room room) async {
    final result = await showDialog<Room>(
      context: context,
      builder: (context) => EditRoomModal(room: room),
    );

    if (result != null) {
      setState(() {
        final index = _rooms.indexWhere((r) => r.id == room.id);
        if (index != -1) {
          _rooms[index] = result;
        }
      });
      _showSuccessSnackBar('Room updated successfully');
    }
  }

  void _copyToClipboard(String text) {
    Clipboard.setData(ClipboardData(text: text));
    _showSuccessSnackBar('Copied to clipboard');
  }

  Future<bool> _showConfirmDialog(String title, String message) async {
    return await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    ) ?? false;
  }

  void _showSuccessSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green,
      ),
    );
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  Future<void> _logout() async {
    await AdminAuthService.logout();
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/');
    }
  }

  List<Room> get _filteredRooms {
    if (_searchTerm.isEmpty) return _rooms;
    return _rooms.where((room) =>
        room.name.toLowerCase().contains(_searchTerm.toLowerCase()) ||
        (room.description?.toLowerCase().contains(_searchTerm.toLowerCase()) ?? false)
    ).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Admin Dashboard'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _createRoom,
            icon: const Icon(Icons.add),
            tooltip: 'Create Room',
          ),
          IconButton(
            onPressed: _logout,
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: TextField(
              controller: _searchController,
              onChanged: (value) {
                setState(() {
                  _searchTerm = value;
                });
              },
              decoration: InputDecoration(
                hintText: 'Search rooms...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                fillColor: Colors.grey.shade50,
              ),
            ),
          ),

          // Stats Cards
          Container(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    'Total Rooms',
                    _rooms.length.toString(),
                    Icons.meeting_room,
                    Colors.blue,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildStatCard(
                    'Active Rooms',
                    _rooms.where((r) => r.isActive).length.toString(),
                    Icons.check_circle,
                    Colors.green,
                  ),
                ),
              ],
            ),
          ),

          // Rooms List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredRooms.isEmpty
                    ? _buildEmptyState()
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _filteredRooms.length,
                        itemBuilder: (context, index) {
                          final room = _filteredRooms[index];
                          return _buildRoomCard(room);
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            title,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.meeting_room_outlined,
            size: 64,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 16),
          Text(
            'No rooms found',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _searchTerm.isEmpty
                ? 'Create your first room to get started'
                : 'Try adjusting your search terms',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey.shade500,
            ),
          ),
          if (_searchTerm.isEmpty) ...[
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _createRoom,
              icon: const Icon(Icons.add),
              label: const Text('Create Room'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF667eea),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildRoomCard(Room room) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Room Header
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        room.name,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (room.description != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          room.description!,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Row(
                  children: [
                    IconButton(
                      onPressed: () => _editRoom(room),
                      icon: const Icon(Icons.edit),
                      tooltip: 'Edit Room',
                    ),
                    IconButton(
                      onPressed: () => _deleteRoom(room.id),
                      icon: const Icon(Icons.delete),
                      tooltip: 'Delete Room',
                    ),
                  ],
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Room Status
            Row(
              children: [
                _buildStatusChip(
                  room.isActive ? 'Active' : 'Inactive',
                  room.isActive ? Colors.green : Colors.grey,
                ),
                const SizedBox(width: 8),
                _buildStatusChip(
                  'Max: ${room.maxParticipants}',
                  Colors.blue,
                ),
                const SizedBox(width: 8),
                _buildStatusChip(
                  room.canRecord ? 'Recording' : 'No Recording',
                  room.canRecord ? Colors.orange : Colors.grey,
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Room Links
            _buildLinkSection(
              'Host Link',
              '${AppConfig.baseUrl}/${room.hostLink}/h',
              Icons.admin_panel_settings,
            ),
            const SizedBox(height: 8),
            _buildLinkSection(
              'Guest Link',
              '${AppConfig.baseUrl}/${room.guestLink}/g',
              Icons.person,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: color,
        ),
      ),
    );
  }

  Widget _buildLinkSection(String title, String link, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: Colors.grey.shade600,
          ),
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: [
              Icon(icon, size: 16, color: Colors.grey.shade600),
              const SizedBox(width: 8),
              Expanded(
                child: SelectableText(
                  link,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade700,
                  ),
                ),
              ),
              IconButton(
                onPressed: () => _copyToClipboard(link),
                icon: const Icon(Icons.copy, size: 16),
                tooltip: 'Copy Link',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
