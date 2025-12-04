import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../models/pdf_annotation_models.dart';
import '../services/api_service.dart';
import '../services/livekit_service.dart';
import '../theme/app_colors.dart';
import '../utils/logger.dart';

class FileSharingWidget extends StatefulWidget {
  final bool isOpen;
  final VoidCallback onClose;
  final String roomName;
  final bool isHost;
  final Function(Map<String, dynamic>)? onFileSelect;
  final Function(String)? onFileSelected; // Callback when file is selected (before upload)

  const FileSharingWidget({
    super.key,
    required this.isOpen,
    required this.onClose,
    required this.roomName,
    required this.isHost,
    this.onFileSelect,
    this.onFileSelected, // New callback for file selection
  });

  @override
  State<FileSharingWidget> createState() => _FileSharingWidgetState();
}

class _FileSharingWidgetState extends State<FileSharingWidget> {
  List<Map<String, dynamic>> _files = [];
  bool _isLoading = false;
  bool _isUploading = false;
  bool _isFilePickerOpen = false; // Track if file picker is currently open
  double _uploadProgress = 0.0;
  String? _error;
  lk.EventsListener<lk.RoomEvent>? _dataListener;

  @override
  void initState() {
    super.initState();
    if (widget.isOpen) {
      _loadFiles();
      _setupDataChannelListener();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Check if there's a pending file upload when widget is recreated
    // This handles the case where widget was disposed during file picker
    // Note: We'll handle this in the parent widget instead
  }

  @override
  void didUpdateWidget(FileSharingWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Only reload if widget was closed and is now opening
    if (widget.isOpen && !oldWidget.isOpen) {
      _loadFiles();
      _setupDataChannelListener();
    } else if (!widget.isOpen && oldWidget.isOpen) {
      // Dispose listener when widget closes
      _dataListener?.dispose();
      _dataListener = null;
    }
  }

  @override
  void dispose() {
    _dataListener?.dispose();
    super.dispose();
  }

  void _setupDataChannelListener() {
    if (_dataListener != null) return; // Already set up
    
    final liveKitService = Provider.of<LiveKitService>(context, listen: false);
    final room = liveKitService.room;

    if (room != null) {
      _dataListener = room.createListener();
      _dataListener!.on<lk.DataReceivedEvent>((event) {
        if (!mounted) return;
        
        try {
          final dataString = utf8.decode(event.data);
          final data = jsonDecode(dataString) as Map<String, dynamic>;

          if (data['type'] == 'file_upload') {
            final file = data['file'] as Map<String, dynamic>?;
            if (file != null) {
              setState(() {
                if (!_files.any((f) => f['id'] == file['id'])) {
                  _files.add(file);
                }
              });
            }
          } else if (data['type'] == 'file_delete') {
            final fileId = data['fileId'] as String?;
            if (fileId != null) {
              setState(() {
                _files.removeWhere((f) => f['id'] == fileId);
              });
            }
          }
        } catch (e) {
          Logger.error('Error handling file data: $e', e, null, 'FileSharingWidget');
        }
      });
    }
  }

  Future<void> _loadFiles() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final files = await ApiService.getRoomFiles(widget.roomName);
      setState(() {
        _files = files;
        _isLoading = false;
      });
    } catch (e) {
      Logger.error('Error loading files: $e', e, null, 'FileSharingWidget');
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _uploadFile() async {
    if (_isUploading || _isFilePickerOpen) return; // Prevent multiple simultaneous uploads
    
    try {
      Logger.debug('Opening file picker...', 'FileSharingWidget');
      
      // Ensure widget is still open before showing file picker
      if (!widget.isOpen || !mounted) {
        Logger.warning('Widget not open or disposed, cannot open file picker', 'FileSharingWidget');
        return;
      }
      
      // Set flag to indicate file picker is opening
      setState(() {
        _isFilePickerOpen = true;
      });
      
      // Use FilePicker to select file
      // Note: On some platforms, this may cause the app to go to background temporarily
      // but the widget should remain mounted when the picker returns
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'ppt', 'pptx', 'txt'],
        withData: false, // Don't load file data into memory, just get path
        withReadStream: false,
      );

      // Clear file picker flag
      if (mounted) {
        setState(() {
          _isFilePickerOpen = false;
        });
      }

      if (result == null || result.files.isEmpty || result.files.single.path == null) {
        // User cancelled file selection - this is normal, just return
        Logger.debug('File selection cancelled by user', 'FileSharingWidget');
        // Clear file picker flag even if cancelled
        if (mounted) {
          setState(() {
            _isFilePickerOpen = false;
          });
        }
        return;
      }

      final filePath = result.files.single.path!;
      
      // Check if widget is still mounted and open after file picker returns
      // If widget is disposed, parent will handle the upload via onFileSelected callback
      final isWidgetStillMounted = mounted && widget.isOpen;
      
      if (!isWidgetStillMounted) {
        Logger.debug('FileSharingWidget closed or disposed during file picker, parent will handle upload: $filePath', 'FileSharingWidget');
        // Notify parent to handle the upload (only if widget is disposed)
        widget.onFileSelected?.call(filePath);
        return;
      }
      
      // Widget is still mounted, so we'll handle the upload here
      // Don't call onFileSelected since we're handling it ourselves

      final file = File(filePath);
      final liveKitService = Provider.of<LiveKitService>(context, listen: false);
      final uploadedBy = liveKitService.localParticipant?.identity ?? 'unknown';

      setState(() {
        _isUploading = true;
        _uploadProgress = 0.0;
      });

      try {
        final uploadedFile = await ApiService.uploadRoomFile(
          roomName: widget.roomName,
          file: file,
          uploadedBy: uploadedBy,
          onProgress: (sent, total) {
            setState(() {
              _uploadProgress = sent / total;
            });
          },
        );

        // Broadcast file upload
        final uploadData = {
          'type': 'file_upload',
          'file': uploadedFile,
          'sender': uploadedBy,
        };
        await liveKitService.sendPdfAnnotationData(uploadData);

        setState(() {
          _files.add(uploadedFile);
          _isUploading = false;
          _uploadProgress = 0.0;
        });

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('File uploaded successfully'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } catch (e) {
        setState(() {
          _isUploading = false;
          _uploadProgress = 0.0;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Upload failed: $e'),
              backgroundColor: AppColors.danger,
            ),
          );
        }
      }
    } catch (e) {
      Logger.error('Error picking file: $e', e, null, 'FileSharingWidget');
      // Reset upload state on error
      if (mounted) {
        setState(() {
          _isUploading = false;
          _isFilePickerOpen = false;
          _uploadProgress = 0.0;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error selecting file: $e'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _deleteFile(dynamic fileId, String fileName) async {
    if (!widget.isHost) return;

    // Show confirmation dialog
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.surfaceElevated,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: const Text(
            'Delete File?',
            style: TextStyle(color: AppColors.textPrimary),
          ),
          content: Text(
            'Are you sure you want to delete "$fileName"? This action cannot be undone.',
            style: const TextStyle(color: AppColors.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text(
                'Cancel',
                style: TextStyle(color: AppColors.textMuted),
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.danger,
                foregroundColor: Colors.white,
              ),
              child: const Text('Delete'),
            ),
          ],
        );
      },
    );

    // If user cancelled, return early
    if (confirmed != true) {
      return;
    }

    try {
      // Convert fileId to String (handles both String and int)
      final fileIdString = fileId is String ? fileId : fileId.toString();
      
      // Get requestedBy for API
      final liveKitService = Provider.of<LiveKitService>(context, listen: false);
      final requestedBy = liveKitService.localParticipant?.identity ?? '';
      
      // Pass participantType so API can format identity correctly
      await ApiService.deleteRoomFile(
        fileIdString, 
        requestedBy: requestedBy,
        participantType: 'HOST', // We know it's host because widget.isHost is true
      );

      // Broadcast file delete
      final deleteData = {
        'type': 'file_delete',
        'fileId': fileIdString,
        'sender': requestedBy,
      };
      await liveKitService.sendPdfAnnotationData(deleteData);

      setState(() {
        _files.removeWhere((f) => f['id'] == fileId);
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('File deleted'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      Logger.error('Error deleting file: $e', e, null, 'FileSharingWidget');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Delete failed: $e'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  void _selectFile(Map<String, dynamic> file) {
    final fileType = file['fileType'] as String? ?? '';
    if (fileType == 'application/pdf') {
      widget.onFileSelect?.call(file);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Only PDF files can be viewed in the PDF viewer'),
          backgroundColor: AppColors.warning,
        ),
      );
    }
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  IconData _getFileIcon(String fileType) {
    if (fileType.contains('pdf')) return Icons.picture_as_pdf;
    if (fileType.contains('image')) return Icons.image;
    if (fileType.contains('word') || fileType.contains('document')) return Icons.description;
    if (fileType.contains('powerpoint') || fileType.contains('presentation')) return Icons.slideshow;
    return Icons.insert_drive_file;
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isOpen) {
      return const SizedBox.shrink();
    }

    return PopScope(
      canPop: !_isUploading && !_isFilePickerOpen, // Prevent back button from closing during upload or file picker
      onPopInvoked: (didPop) {
        if (!didPop && !_isUploading && !_isFilePickerOpen) {
          widget.onClose();
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.overlayDark,
        body: SafeArea(
          child: Container(
            margin: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
              // Header
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: AppColors.outline, width: 1),
                  ),
                ),
                child: Row(
                  children: [
                    const Text(
                      '📁 File Sharing',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    if (widget.isHost)
                      IconButton(
                        icon: const Icon(Icons.add, color: AppColors.primary),
                        onPressed: _isUploading ? null : _uploadFile,
                        tooltip: 'Upload file',
                      ),
                    IconButton(
                      icon: const Icon(Icons.close, color: AppColors.textPrimary),
                      onPressed: widget.onClose,
                    ),
                  ],
                ),
              ),

              // Upload progress
              if (_isUploading)
                Container(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      LinearProgressIndicator(
                        value: _uploadProgress,
                        backgroundColor: AppColors.surfaceMuted,
                        valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Uploading... ${(_uploadProgress * 100).toStringAsFixed(0)}%',
                        style: const TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),

              // Files list
              Flexible(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(color: AppColors.primary),
                      )
                    : _error != null
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.error_outline,
                                    size: 48, color: AppColors.danger),
                                const SizedBox(height: 16),
                                Text(
                                  'Error loading files',
                                  style: const TextStyle(color: AppColors.textPrimary),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _error!,
                                  style: const TextStyle(color: AppColors.textSecondary),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 16),
                                ElevatedButton(
                                  onPressed: _loadFiles,
                                  child: const Text('Retry'),
                                ),
                              ],
                            ),
                          )
                        : _files.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.folder_open,
                                        size: 64, color: AppColors.textMuted),
                                    const SizedBox(height: 16),
                                    Text(
                                      'No files yet',
                                      style: const TextStyle(color: AppColors.textMuted),
                                    ),
                                    if (widget.isHost) ...[
                                      const SizedBox(height: 8),
                                      Text(
                                        'Tap + to upload a file',
                                        style: const TextStyle(color: AppColors.textMuted),
                                      ),
                                    ],
                                  ],
                                ),
                              )
                            : ListView.builder(
                                itemCount: _files.length,
                                itemBuilder: (context, index) {
                                  final file = _files[index];
                                  final fileType = file['fileType'] as String? ?? '';
                                  final isPdf = fileType == 'application/pdf';

                                  return ListTile(
                                    leading: Icon(
                                      _getFileIcon(fileType),
                                      color: isPdf ? AppColors.danger : AppColors.textPrimary,
                                      size: 32,
                                    ),
                                    title: Text(
                                      file['originalName'] as String? ?? 'Unknown',
                                      style: const TextStyle(color: AppColors.textPrimary),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    subtitle: Text(
                                      _formatFileSize(file['size'] as int? ?? 0),
                                      style: const TextStyle(color: AppColors.textSecondary),
                                    ),
                                    trailing: widget.isHost
                                        ? IconButton(
                                            icon: const Icon(Icons.delete,
                                                color: AppColors.danger),
                                            onPressed: () => _deleteFile(
                                                file['id'],
                                                file['originalName'] as String? ?? 'Unknown File',
                                            ),
                                          )
                                        : null,
                                    onTap: isPdf ? () => _selectFile(file) : null,
                                  );
                                },
                              ),
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }
}

