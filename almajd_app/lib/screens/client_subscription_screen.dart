import 'package:flutter/material.dart';
import '../utils/logger.dart';
import '../services/api_service.dart';
import '../utils/logger.dart';
import '../models/client_models.dart';
import '../utils/logger.dart';
import '../widgets/client/stat_card.dart';
import '../utils/logger.dart';

class ClientSubscriptionScreen extends StatefulWidget {
  const ClientSubscriptionScreen({super.key});

  @override
  State<ClientSubscriptionScreen> createState() => _ClientSubscriptionScreenState();
}

class _ClientSubscriptionScreenState extends State<ClientSubscriptionScreen> {
  ClientSubscription? _subscription;
  ClientLimits? _limits;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final subscriptionFuture = ApiService.getClientSubscription().catchError((e) => null as ClientSubscription?);
      final limitsFuture = ApiService.getClientLimits().catchError((e) => null as ClientLimits?);

      final results = await Future.wait([
        subscriptionFuture,
        limitsFuture,
      ]);

      setState(() {
        _subscription = results[0] as ClientSubscription?;
        _limits = results[1] as ClientLimits?;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'ACTIVE':
        return Colors.green;
      case 'EXPIRED':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  String _getStatusText(String status) {
    switch (status) {
      case 'ACTIVE':
        return 'Active';
      case 'EXPIRED':
        return 'Expired';
      default:
        return 'Inactive';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
                      const SizedBox(height: 16),
                      Text(
                        'Error loading subscription',
                        style: TextStyle(fontSize: 18, color: Colors.grey[800]),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _error!,
                        style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: _loadData,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Subscription Status Card
                        if (_subscription != null)
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.05),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text(
                                      'Subscription Status',
                                      style: TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF0F1A3A),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 16,
                                        vertical: 8,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _getStatusColor(_subscription!.status)
                                            .withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(20),
                                        border: Border.all(
                                          color: _getStatusColor(_subscription!.status),
                                        ),
                                      ),
                                      child: Text(
                                        _getStatusText(_subscription!.status),
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: _getStatusColor(_subscription!.status),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                if (_subscription!.plan != null) ...[
                                  const SizedBox(height: 16),
                                  Divider(),
                                  const SizedBox(height: 16),
                                  Text(
                                    _subscription!.plan!.name,
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF0F1A3A),
                                    ),
                                  ),
                                  if (_subscription!.plan!.description != null) ...[
                                    const SizedBox(height: 8),
                                    Text(
                                      _subscription!.plan!.description!,
                                      style: TextStyle(
                                        fontSize: 14,
                                        color: Colors.grey[600],
                                      ),
                                    ),
                                  ],
                                ],
                              ],
                            ),
                          ),
                        const SizedBox(height: 24),

                        // Limits Section
                        if (_limits != null) ...[
                          const Text(
                            'Your Limits',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0F1A3A),
                            ),
                          ),
                          const SizedBox(height: 16),
                          GridView.count(
                            crossAxisCount: 2,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisSpacing: 16,
                            mainAxisSpacing: 16,
                            childAspectRatio: 1.2,
                            children: [
                              StatCard(
                                title: 'Max Rooms',
                                value: '${_limits!.maxRooms}',
                                icon: Icons.meeting_room,
                                color: Colors.blue,
                                subtitle: '${_limits!.currentRooms} used',
                              ),
                              StatCard(
                                title: 'Max Participants',
                                value: '${_limits!.maxParticipants}',
                                icon: Icons.people,
                                color: Colors.purple,
                                subtitle: 'Per room',
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                        ],

                        // Features Section
                        if (_subscription?.plan?.features != null &&
                            _subscription!.plan!.features.isNotEmpty) ...[
                          const Text(
                            'Plan Features',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0F1A3A),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.05),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Column(
                              children: _subscription!.plan!.features
                                  .map((feature) => Padding(
                                        padding: const EdgeInsets.only(bottom: 12),
                                        child: Row(
                                          children: [
                                            Icon(
                                              feature.enabled
                                                  ? Icons.check_circle
                                                  : Icons.cancel,
                                              color: feature.enabled
                                                  ? Colors.green
                                                  : Colors.grey,
                                              size: 20,
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Text(
                                                feature.feature,
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  color: Colors.grey[800],
                                                  decoration: feature.enabled
                                                      ? null
                                                      : TextDecoration.lineThrough,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ))
                                  .toList(),
                            ),
                          ),
                        ],

                        // Support Section
                        const SizedBox(height: 24),
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.blue[50],
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.blue[200]!),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.info_outline,
                                      color: Colors.blue[700], size: 20),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Need to upgrade?',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: Colors.blue[900],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Contact support to upgrade your subscription plan',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.blue[800],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
    );
  }
}


