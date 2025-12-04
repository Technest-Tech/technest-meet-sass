import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/client_models.dart';

class RoomCard extends StatelessWidget {
  final ClientRoom room;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onTap;

  const RoomCard({
    super.key,
    required this.room,
    this.onEdit,
    this.onDelete,
    this.onTap,
  });

  void _copyToClipboard(BuildContext context, String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied to clipboard'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 2,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                            color: Color(0xFF0F1A3A),
                          ),
                        ),
                        if (room.description != null && room.description!.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            room.description!,
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey[600],
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: room.isActive
                          ? Colors.green[50]
                          : Colors.grey[200],
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      room.isActive ? 'Active' : 'Inactive',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: room.isActive
                            ? Colors.green[700]
                            : Colors.grey[700],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Links Section
              _buildLinkRow(
                context,
                'Host Link',
                room.hostLink,
                Icons.person,
                Colors.blue,
              ),
              const SizedBox(height: 8),
              _buildLinkRow(
                context,
                'Guest Link',
                room.guestLink,
                Icons.people,
                Colors.green,
              ),
              if (room.observerLink != null) ...[
                const SizedBox(height: 8),
                _buildLinkRow(
                  context,
                  'Observer Link',
                  room.observerLink!,
                  Icons.visibility,
                  Colors.purple,
                ),
              ],
              const SizedBox(height: 16),

              // Stats and Actions
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.people_outline, size: 16, color: Colors.grey[600]),
                      const SizedBox(width: 4),
                      Text(
                        '${room.counts.participants} participants',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Icon(Icons.folder_outlined, size: 16, color: Colors.grey[600]),
                      const SizedBox(width: 4),
                      Text(
                        '${room.counts.files} files',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      if (onEdit != null)
                        IconButton(
                          icon: const Icon(Icons.edit_outlined, size: 20),
                          color: Colors.blue,
                          onPressed: onEdit,
                          tooltip: 'Edit',
                        ),
                      if (onDelete != null)
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 20),
                          color: Colors.red,
                          onPressed: onDelete,
                          tooltip: 'Delete',
                        ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLinkRow(
    BuildContext context,
    String label,
    String link,
    IconData icon,
    Color color,
  ) {
    return InkWell(
      onTap: () => _copyToClipboard(context, link, label),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    link,
                    style: TextStyle(
                      fontSize: 13,
                      color: color,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Icon(Icons.copy, size: 16, color: color),
          ],
        ),
      ),
    );
  }
}


