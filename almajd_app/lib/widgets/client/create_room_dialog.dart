import 'package:flutter/material.dart';
import 'client_text_field.dart';
import 'client_button.dart';

class CreateRoomDialog extends StatefulWidget {
  final String? roomName;
  final String? description;
  final bool isEdit;
  final bool? hostApproval;
  final bool? canRecord;
  final bool? requireWaitingRoom;
  final bool? allowGuestUnmute;
  final bool? enablePrivateChat;

  const CreateRoomDialog({
    super.key,
    this.roomName,
    this.description,
    this.isEdit = false,
    this.hostApproval,
    this.canRecord,
    this.requireWaitingRoom,
    this.allowGuestUnmute,
    this.enablePrivateChat,
  });

  @override
  State<CreateRoomDialog> createState() => _CreateRoomDialogState();
}

class _CreateRoomDialogState extends State<CreateRoomDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _isLoading = false;
  String? _error;
  
  // Room settings
  bool _hostApproval = false;
  bool _canRecord = false;
  bool _requireWaitingRoom = false;
  bool _allowGuestUnmute = true;
  bool _enablePrivateChat = true;

  @override
  void initState() {
    super.initState();
    if (widget.isEdit) {
      _nameController.text = widget.roomName ?? '';
      _descriptionController.text = widget.description ?? '';
      _hostApproval = widget.hostApproval ?? false;
      _canRecord = widget.canRecord ?? false;
      _requireWaitingRoom = widget.requireWaitingRoom ?? false;
      _allowGuestUnmute = widget.allowGuestUnmute ?? true;
      _enablePrivateChat = widget.enablePrivateChat ?? true;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    // Return the form data to the parent widget
    Navigator.of(context).pop({
      'name': _nameController.text.trim(),
      'description': _descriptionController.text.trim().isEmpty
          ? null
          : _descriptionController.text.trim(),
      'hostApproval': _hostApproval,
      'canRecord': _canRecord,
      'requireWaitingRoom': _requireWaitingRoom,
      'allowGuestUnmute': _allowGuestUnmute,
      'enablePrivateChat': _enablePrivateChat,
    });
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      backgroundColor: Colors.white,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: 500,
          maxHeight: MediaQuery.of(context).size.height * 0.9,
        ),
        padding: const EdgeInsets.all(24),
        color: Colors.white,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.isEdit ? 'Edit Room' : 'Create Room',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F1A3A),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Name Field
              ClientTextField(
                label: 'Room Name',
                hint: 'Enter room name',
                controller: _nameController,
                prefixIcon: Icons.meeting_room_outlined,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Room name is required';
                  }
                  if (value.trim().length < 3) {
                    return 'Room name must be at least 3 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Description Field
              ClientTextField(
                label: 'Description (Optional)',
                hint: 'Enter room description',
                controller: _descriptionController,
                prefixIcon: Icons.description_outlined,
                maxLines: 3,
              ),
              const SizedBox(height: 24),

              // Room Settings Section
              const Text(
                'Room Settings',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F1A3A),
                ),
              ),
              const SizedBox(height: 16),
              
              // Settings Checkboxes
              _buildCheckbox(
                'Host Approval Required',
                'Require host approval before guests can join',
                _hostApproval,
                (value) => setState(() => _hostApproval = value),
                Icons.person_add,
              ),
              const SizedBox(height: 12),
              _buildCheckbox(
                'Enable Recording',
                'Allow recording of meetings',
                _canRecord,
                (value) => setState(() => _canRecord = value),
                Icons.videocam,
              ),
              const SizedBox(height: 12),
              _buildCheckbox(
                'Require Waiting Room',
                'Guests must wait for approval before joining',
                _requireWaitingRoom,
                (value) => setState(() => _requireWaitingRoom = value),
                Icons.meeting_room,
              ),
              const SizedBox(height: 12),
              _buildCheckbox(
                'Allow Guest Unmute',
                'Guests can unmute themselves',
                _allowGuestUnmute,
                (value) => setState(() => _allowGuestUnmute = value),
                Icons.mic,
              ),
              const SizedBox(height: 12),
              _buildCheckbox(
                'Enable Private Chat',
                'Allow private messaging between participants',
                _enablePrivateChat,
                (value) => setState(() => _enablePrivateChat = value),
                Icons.chat,
              ),
              const SizedBox(height: 24),

              // Error Message
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red[50],
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red[200]!),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, color: Colors.red[700], size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _error!,
                          style: TextStyle(
                            color: Colors.red[700],
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              if (_error != null) const SizedBox(height: 16),

              // Buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: _isLoading
                        ? null
                        : () => Navigator.of(context).pop(),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 12),
                  ClientButton(
                    text: widget.isEdit ? 'Update' : 'Create',
                    onPressed: _isLoading ? null : _handleSubmit,
                    isLoading: _isLoading,
                    icon: widget.isEdit ? Icons.save : Icons.add,
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

  Widget _buildCheckbox(
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool> onChanged,
    IconData icon,
  ) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: value ? Colors.blue[50] : Colors.grey[50],
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: value ? Colors.blue[300]! : Colors.grey[300]!,
          ),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 20,
              color: value ? Colors.blue[700] : Colors.grey[600],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: value ? Colors.blue[900] : Colors.grey[800],
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            Checkbox(
              value: value,
              onChanged: (newValue) => onChanged(newValue ?? false),
              activeColor: const Color(0xFF1C7ED6),
              checkColor: Colors.white,
              fillColor: WidgetStateProperty.resolveWith<Color>((Set<WidgetState> states) {
                if (states.contains(WidgetState.selected)) {
                  return const Color(0xFF1C7ED6);
                }
                return Colors.white;
              }),
            ),
          ],
        ),
      ),
    );
  }
}

