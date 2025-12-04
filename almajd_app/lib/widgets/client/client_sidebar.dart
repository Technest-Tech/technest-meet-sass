import 'package:flutter/material.dart';

class ClientSidebar extends StatelessWidget {
  final String userEmail;
  final int selectedIndex;
  final void Function(int) onItemSelected;
  final VoidCallback onLogout;

  const ClientSidebar({
    super.key,
    required this.userEmail,
    required this.selectedIndex,
    required this.onItemSelected,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    final menuItems = [
      {'icon': Icons.dashboard, 'label': 'Dashboard', 'index': 0},
      {'icon': Icons.meeting_room, 'label': 'Rooms', 'index': 1},
      {'icon': Icons.credit_card, 'label': 'Subscription', 'index': 2},
      {'icon': Icons.settings, 'label': 'Settings', 'index': 3},
    ];

    return Drawer(
      backgroundColor: Colors.white,
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 40, 16, 16),
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C7ED6),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.person,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Client Dashboard',
                  style: TextStyle(
                    color: Color(0xFF0F1A3A),
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  userEmail,
                  style: TextStyle(
                    color: Colors.grey[700],
                    fontSize: 12,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),

          // Menu Items
          Expanded(
            child: Container(
              color: Colors.white,
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: menuItems.map((item) {
                  final itemIndex = item['index'] as int;
                  final isSelected = selectedIndex == itemIndex;
                  return Container(
                    color: Colors.white,
                    child: ListTile(
                      leading: Icon(
                        item['icon'] as IconData,
                        color: isSelected
                            ? const Color(0xFF1C7ED6)
                            : const Color(0xFF0F1A3A),
                      ),
                      title: Text(
                        item['label'] as String,
                        style: TextStyle(
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                          color: isSelected
                              ? const Color(0xFF1C7ED6)
                              : const Color(0xFF0F1A3A),
                        ),
                      ),
                      selected: isSelected,
                      selectedTileColor: const Color(0xFF1C7ED6).withValues(alpha: 0.1),
                      tileColor: Colors.white,
                      onTap: () => onItemSelected(itemIndex),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // Logout Button
          Container(
            color: Colors.white,
            child: Column(
              children: [
                const Divider(height: 1, color: Colors.grey),
                ListTile(
                  tileColor: Colors.white,
                  leading: const Icon(Icons.logout, color: Colors.red),
                  title: const Text(
                    'Logout',
                    style: TextStyle(
                      color: Colors.red,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onTap: onLogout,
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}


