import 'package:flutter/material.dart';
import '../utils/logger.dart';
import '../utils/responsive.dart';
import '../theme/app_theme.dart';
import '../utils/logger.dart';
import 'tabs/join_by_link_tab.dart';
import '../utils/logger.dart';
import 'tabs/join_by_id_tab.dart';
import '../utils/logger.dart';
import 'tabs/recent_rooms_tab.dart';
import '../utils/logger.dart';
import 'tabs/quick_join_tab.dart';
import '../utils/logger.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  int _currentIndex = 0;
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: 0);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: AppTheme.primaryGradient,
        ),
        child: SafeArea(
          child: Column(
            children: [
              // App Header
              Container(
                padding: Responsive.padding(
                  context,
                  horizontal: AppTheme.spacingL.toDouble(),
                  vertical: AppTheme.spacingM.toDouble(),
                ),
                child: Row(
                  children: [
                    Image.asset(
                      'assets/icons/academiq-meet-logo.png',
                      width: Responsive.value(context, phone: 40.0, tablet: 48.0),
                      height: Responsive.value(context, phone: 40.0, tablet: 48.0),
                      fit: BoxFit.contain,
                    ),
                    SizedBox(width: Responsive.spacing(context, phone: AppTheme.spacingM.toDouble(), tablet: AppTheme.spacingL.toDouble())),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Academiq Meet',
                          style: TextStyle(
                            fontSize: Responsive.fontSize(context, phone: 24.0, tablet: 28.0),
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        Text(
                          'Live Class System',
                          style: TextStyle(
                            fontSize: Responsive.fontSize(context, phone: 12.0, tablet: 14.0),
                            color: Colors.white70,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Page View for tabs
              Expanded(
                child: PageView(
                  controller: _pageController,
                  onPageChanged: (index) {
                    setState(() {
                      _currentIndex = index;
                    });
                  },
                  children: const [
                    JoinByLinkTab(),
                    JoinByIdTab(),
                    RecentRoomsTab(),
                    QuickJoinTab(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: Container(
        decoration: AppTheme.glassmorphism(
          color: Colors.black,
          opacity: 0.9,
          blur: 20.0,
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: _onTabTapped,
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.transparent,
          selectedItemColor: Colors.white,
          unselectedItemColor: Colors.white70,
          elevation: 0,
          selectedLabelStyle: const TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
          unselectedLabelStyle: const TextStyle(
            fontWeight: FontWeight.w500,
            fontSize: 11,
          ),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.link),
              activeIcon: Icon(Icons.link),
              label: 'Join by Link',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.tag),
              activeIcon: Icon(Icons.tag),
              label: 'Join by ID',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.history),
              activeIcon: Icon(Icons.history),
              label: 'Recent',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.star_outline),
              activeIcon: Icon(Icons.star),
              label: 'Favorites',
            ),
          ],
        ),
      ),
    );
  }
}













