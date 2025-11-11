'use client';

import React, { useState, useEffect } from 'react';
import {
  Video, Users, Shield, Zap, Globe, MessageCircle, Mail, Phone, ArrowRight, CheckCircle, Menu, X,
  GraduationCap, School, BookOpen, UserCheck, Eye, PenTool, FileText, Share2, Mic, Hand,
  Lock, Monitor, Smartphone, Clock, Settings, BarChart3, PlayCircle, Camera, ScreenShare,
  FileImage, Sparkles, Award, TrendingUp, Heart, Star, ChevronRight, Download, Upload,
  Grid3x3, Layers, Eraser, Type, Circle, Square, Triangle, ArrowUpRight, MessageSquare,
  VideoOff, Headphones, Calendar, Bell, Search, Filter, MoreVertical, Copy, Link as LinkIcon
} from 'lucide-react';
import Link from 'next/link';

export default function Page() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Intersection Observer for scroll animations
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisibleSections((prev) => new Set([...prev, entry.target.id]));
        }
      });
    }, observerOptions);

    // Observe all sections
    const sections = document.querySelectorAll('section[id]');
    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div dir="rtl" className="w-full bg-white relative" style={{ minHeight: '100vh', overflowY: 'auto' }}>
      {/* Modern Header - V.CONNCT Style */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 bg-white shadow-md border-b border-gray-200`}>
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo and Brand */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="relative bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                  <img 
                    src="/academiq-meet-logo.png" 
                    alt="Academiq-meet Logo" 
                    className="h-8 w-auto object-contain"
                  />
                </div>
              </div>
              <span className="text-xl font-bold text-gray-900">
                Academiq-meet
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              <button
                onClick={() => scrollToSection('features')}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all flex items-center gap-1"
              >
                المميزات
                <ChevronRight className="w-4 h-4 rotate-[-90deg]" />
              </button>
              <button
                onClick={() => scrollToSection('use-cases')}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all flex items-center gap-1"
              >
                حالات الاستخدام
                <ChevronRight className="w-4 h-4 rotate-[-90deg]" />
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all flex items-center gap-1"
              >
                كيف يعمل
                <ChevronRight className="w-4 h-4 rotate-[-90deg]" />
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all flex items-center gap-1"
              >
                تواصل معنا
                <ChevronRight className="w-4 h-4 rotate-[-90deg]" />
              </button>
              <Link
                href="/client/login"
                className="mr-2 px-6 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2"
              >
                <span>تسجيل الدخول</span>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-700" />
              ) : (
                <Menu className="w-6 h-6 text-gray-700" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden pb-6 border-t border-gray-200 mt-2 pt-4 bg-white rounded-lg shadow-lg">
              <div className="flex flex-col gap-2 px-2">
                <button
                  onClick={() => scrollToSection('features')}
                  className="text-right text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-100 transition-all"
                >
                  المميزات
                </button>
                <button
                  onClick={() => scrollToSection('use-cases')}
                  className="text-right text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-100 transition-all"
                >
                  حالات الاستخدام
                </button>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="text-right text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-100 transition-all"
                >
                  كيف يعمل
                </button>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="text-right text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-100 transition-all"
                >
                  تواصل معنا
                </button>
                <Link
                  href="/client/login"
                  className="mt-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-semibold text-center transition-all"
                >
                  تسجيل الدخول
                </Link>
              </div>
            </div>
          )}
        </nav>
      </header>


      {/* Main Content */}
      <div className="relative z-10 pb-12 lg:pb-20">
        
        {/* Hero Section - Redesigned */}
        <section className="w-full mb-20 lg:mb-32 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 py-24 lg:py-32 pt-28">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Left Column - Content */}
                <div className="text-right space-y-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full mb-4">
                    <Sparkles className="w-4 h-4 text-white" />
                    <span className="text-sm font-semibold text-white">إدارة اجتماعات ومحاضرات ودروس احترافية</span>
                  </div>
                  
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
                    <span className="block text-white mb-2">منصة</span>
                    <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
                      Academiq-meet
                    </span>
                    <span className="block text-white mt-2">ادارة اجتماعاتك ومحاضراتك ودروسك</span>
                  </h1>
                  
                  <p className="text-lg sm:text-xl text-white/90 leading-relaxed max-w-xl">
                    حل متكامل وحديث لإدارة اجتماعاتك ومحاضراتك ودروسك الافتراضية بسهولة وأمان تام. منصة شاملة للأكاديميات والمدارس ومراكز التدريب
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <Link
                      href="/client/login"
                      className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 rounded-xl font-bold text-lg shadow-2xl shadow-white/20 hover:shadow-white/30 hover:scale-105 transition-all duration-300"
                    >
                      <span>ابدأ الآن</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <button
                      onClick={() => scrollToSection('features')}
                      className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 rounded-xl font-semibold text-lg hover:bg-white/20 hover:scale-105 transition-all duration-300"
                    >
                      <Video className="w-5 h-5" />
                      <span>استكشف المميزات</span>
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/20">
                    <div>
                      <div className="text-3xl font-bold text-cyan-300">20+</div>
                      <div className="text-sm text-white/80">ميزة متقدمة</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-cyan-300">100%</div>
                      <div className="text-sm text-white/80">آمن ومحمي</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-cyan-300">24/7</div>
                      <div className="text-sm text-white/80">دعم فني</div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Visual */}
                <div className="relative hidden lg:block">
                  <div className="relative">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/30 to-blue-400/20 rounded-3xl blur-3xl transform rotate-6"></div>
                    
                    {/* Logo Container */}
                    <div className="relative bg-white rounded-3xl p-12 border-4 border-cyan-300 shadow-2xl transform hover:scale-105 transition-transform duration-500">
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-3xl"></div>
                      <div className="relative">
                        <img 
                          src="/academiq-meet-logo.png" 
                          alt="Academiq-meet Logo" 
                          className="w-full h-auto object-contain drop-shadow-2xl"
                        />
                      </div>
                    </div>

                    {/* Floating elements */}
                    <div className="absolute -top-8 -right-8 w-24 h-24 bg-cyan-300/30 rounded-2xl blur-xl animate-pulse"></div>
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-blue-300/30 rounded-2xl blur-xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Showcase Section - Blue Theme */}
        <section 
          id="features" 
          className={`w-full mb-20 lg:mb-32 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-blue-50 to-indigo-50 py-20 ${
            visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 text-center mb-4">
            مميزات متقدمة للتعليم الإلكتروني
          </h2>
          <p className="text-xl text-gray-700 text-center mb-12 max-w-2xl mx-auto">
            مجموعة شاملة من الأدوات والمميزات المصممة خصيصاً لتحسين تجربة التعليم الإلكتروني
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Feature Cards */}
            {[
              { icon: Video, title: 'اجتماعات مرئية عالية الجودة', desc: 'جودة صوت وصورة استثنائية مع دعم لأعداد كبيرة من المشاركين' },
              { icon: PenTool, title: 'سبورة تفاعلية تعاونية', desc: 'سبورة تفاعلية متقدمة للرسم والكتابة والتعاون في الوقت الفعلي' },
              { icon: Layers, title: 'سبورة عادية متقدمة', desc: 'سبورة شخصية مع أدوات متقدمة للرسم والأشكال والنصوص' },
              { icon: ScreenShare, title: 'مشاركة الشاشة والتعليق', desc: 'شارك شاشتك مع إمكانية التعليق والرسم عليها مباشرة' },
              { icon: PlayCircle, title: 'تسجيل الجلسات', desc: 'سجل جميع الجلسات بجودة عالية مع إمكانية المشاهدة لاحقاً' },
              { icon: UserCheck, title: 'غرفة الانتظار', desc: 'تحكم كامل في دخول المشاركين مع نظام موافقة متقدم' },
              { icon: Lock, title: 'تشفير من طرف إلى طرف', desc: 'حماية كاملة للبيانات مع تشفير E2EE متقدم' },
              { icon: FileText, title: 'مشاركة الملفات', desc: 'شارك الملفات والوثائق بسهولة مع جميع المشاركين' },
              { icon: FileImage, title: 'عارض PDF', desc: 'عرض ملفات PDF مباشرة داخل الجلسة مع أدوات التعليق' },
              { icon: Sparkles, title: 'التفاعلات', desc: 'تفاعل مع المحتوى باستخدام الإيموجي والتفاعلات المباشرة' },
              { icon: Hand, title: 'رفع اليد', desc: 'نظام رفع اليد للمشاركة والتفاعل المنظم' },
              { icon: Monitor, title: 'مراقبة الطلاب', desc: 'ميزة Picture-in-Picture لمراقبة الطلاب أثناء الجلسة' },
              { icon: Eye, title: 'وضع المراقب الصامت', desc: 'مراقبة الجلسات بشكل سري تماماً دون ظهور للمشاركين' },
              { icon: Camera, title: 'خلفيات افتراضية', desc: 'استخدم خلفيات افتراضية احترافية لتحسين المظهر' },
              { icon: MessageSquare, title: 'دردشة خاصة', desc: 'دردشة عامة وخاصة مع جميع المشاركين' },
              { icon: Mic, title: 'إلغاء كتم الضيوف', desc: 'السماح للضيوف بإلغاء كتم الصوت بأنفسهم' },
              { icon: Users, title: 'إدارة المشاركين', desc: 'تحكم كامل في المشاركين والصلاحيات والإعدادات' },
              { icon: Shield, title: 'أمان متقدم', desc: 'نظام أمان متعدد الطبقات لحماية الجلسات والبيانات' },
              { icon: Globe, title: 'متوافق مع جميع الأجهزة', desc: 'يعمل على جميع المتصفحات والأجهزة بدون تثبيت' },
              { icon: Smartphone, title: 'تطبيق موبايل', desc: 'تطبيق موبايل متكامل لنظام iOS و Android' },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 hover:scale-105 group"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Use Cases Section - Green Theme */}
        <section 
          id="use-cases" 
          className={`w-full mb-20 lg:mb-32 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-emerald-50 to-teal-50 py-20 ${
            visibleSections.has('use-cases') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 text-center mb-4">
            مثالي للأكاديميات والمدارس
          </h2>
          <p className="text-xl text-gray-700 text-center mb-12 max-w-2xl mx-auto">
            حل متكامل مصمم خصيصاً لاحتياجات المؤسسات التعليمية
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {[
              {
                icon: GraduationCap,
                title: 'الأكاديميات الإلكترونية',
                desc: 'إدارة فصول افتراضية متعددة مع تتبع الطلاب والتقارير التفصيلية',
                features: ['فصول متعددة', 'تتبع الحضور', 'تقارير مفصلة', 'إدارة الطلاب']
              },
              {
                icon: School,
                title: 'المدارس والمؤسسات التعليمية',
                desc: 'نظام متكامل لإدارة الفصول الدراسية الافتراضية مع جميع الأدوات اللازمة',
                features: ['فصول دراسية', 'تسجيل الجلسات', 'مشاركة المواد', 'تفاعل مباشر']
              },
              {
                icon: BookOpen,
                title: 'مراكز التدريب',
                desc: 'حل مثالي لمراكز التدريب والدورات التعليمية مع إمكانيات متقدمة',
                features: ['دورات تدريبية', 'تقييم الطلاب', 'شهادات', 'متابعة التقدم']
              },
              {
                icon: UserCheck,
                title: 'خدمات الدروس الخصوصية',
                desc: 'منصة احترافية للدروس الخصوصية مع أدوات تفاعلية متقدمة',
                features: ['جلسات فردية', 'سبورة تفاعلية', 'مشاركة الملفات', 'تسجيل الجلسات']
              },
            ].map((useCase, index) => (
              <div
                key={index}
                className="bg-white rounded-3xl p-8 lg:p-10 border border-gray-200 hover:border-emerald-400 hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                  <useCase.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{useCase.title}</h3>
                <p className="text-gray-600 text-lg mb-6 leading-relaxed">{useCase.desc}</p>
                <ul className="space-y-3">
                  {useCase.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Advanced Features Section - Purple Theme */}
        <section 
          id="advanced-features" 
          className={`w-full mb-20 lg:mb-32 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-purple-50 to-pink-50 py-20 ${
            visibleSections.has('advanced-features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl p-8 lg:p-12 border border-gray-200 shadow-2xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 border border-purple-300 rounded-full mb-4">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span className="text-purple-600 font-semibold">مميزات جديدة ومتقدمة</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                مميزات متطورة للتعليم الحديث
              </h2>
              <p className="text-xl text-gray-700 max-w-2xl mx-auto">
                اكتشف أحدث المميزات المصممة لتحسين تجربة التعليم الإلكتروني
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {[
                {
                  icon: Eye,
                  title: 'وضع المراقب الصامت',
                  desc: 'مراقبة الجلسات بشكل كامل دون ظهور للمشاركين - مثالي لمراقبة جودة التدريس',
                  badge: 'جديد'
                },
                {
                  icon: Layers,
                  title: 'نظام سبورة مزدوج',
                  desc: 'سبورة تعاونية للعمل الجماعي وسبورة عادية للاستخدام الشخصي مع أدوات متقدمة',
                  badge: 'متقدم'
                },
                {
                  icon: Monitor,
                  title: 'مراقبة الطلاب PiP',
                  desc: 'ميزة Picture-in-Picture لمراقبة جميع الطلاب في نافذة منفصلة',
                  badge: 'حصري'
                },
                {
                  icon: PlayCircle,
                  title: 'تسجيل متقدم',
                  desc: 'تسجيل عالي الجودة مع إمكانية التحرير والمشاركة والتخزين السحابي',
                  badge: 'احترافي'
                },
                {
                  icon: Award,
                  title: 'تخصيص العلامة التجارية',
                  desc: 'خصص المنصة بعلامتك التجارية مع الشعارات والألوان المخصصة',
                  badge: 'مميز'
                },
                {
                  icon: BarChart3,
                  title: 'تقارير وتحليلات',
                  desc: 'تقارير مفصلة عن الحضور والتفاعل والأداء مع إحصائيات شاملة',
                  badge: 'ذكي'
                },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-2xl p-6 border border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    {feature.badge && (
                      <span className="px-3 py-1 bg-purple-100 border border-purple-300 text-purple-600 text-sm font-semibold rounded-full">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
          </div>
        </section>

        {/* Security & Privacy Section - Orange Theme */}
        <section 
          id="security" 
          className={`w-full mb-20 lg:mb-32 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-orange-50 to-amber-50 py-20 ${
            visibleSections.has('security') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl p-8 lg:p-12 border border-gray-200 shadow-2xl">
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                أمان وحماية على أعلى مستوى
              </h2>
              <p className="text-xl text-gray-700 max-w-2xl mx-auto">
                نحمي بياناتك وجلساتك بأحدث تقنيات الأمان والحماية
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Lock, title: 'تشفير من طرف إلى طرف', desc: 'E2EE متقدم لحماية جميع البيانات والاتصالات' },
                { icon: Shield, title: 'تحكم في الوصول', desc: 'نظام صلاحيات متقدم مع غرف انتظار وموافقات' },
                { icon: UserCheck, title: 'إدارة المشاركين', desc: 'تحكم كامل في من يمكنه الانضمام والتفاعل' },
                { icon: Eye, title: 'مراقبة الأمان', desc: 'مراقبة مستمرة للجلسات مع سجلات الأمان' },
                { icon: FileText, title: 'حماية البيانات', desc: 'حماية كاملة للبيانات مع امتثال للمعايير الدولية' },
                { icon: Settings, title: 'إعدادات أمان متقدمة', desc: 'تخصيص إعدادات الأمان حسب احتياجاتك' },
              ].map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-2xl p-6 border border-gray-200 hover:border-orange-400 hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-4 px-8 py-4 bg-orange-100 border border-orange-300 rounded-xl">
                <CheckCircle className="w-6 h-6 text-orange-600" />
                <span className="text-orange-600 font-semibold text-lg">جميع الجلسات محمية بتشفير متقدم</span>
              </div>
            </div>
          </div>
          </div>
        </section>

        {/* Benefits Section - Cyan Theme */}
        <section 
          id="benefits" 
          className={`w-full mb-20 lg:mb-32 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-cyan-50 to-blue-50 py-20 ${
            visibleSections.has('benefits') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 text-center mb-4">
            لماذا Academiq-meet؟
          </h2>
          <p className="text-xl text-gray-700 text-center mb-12 max-w-2xl mx-auto">
            فوائد حقيقية لمؤسستك التعليمية
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: 'سهولة الإعداد', desc: 'ابدأ في دقائق بدون تعقيدات تقنية' },
              { icon: TrendingUp, title: 'قابل للتوسع', desc: 'يدعم أي عدد من الفصول والمشاركين' },
              { icon: Globe, title: 'متعدد المنصات', desc: 'يعمل على جميع الأجهزة والمتصفحات' },
              { icon: Smartphone, title: 'تطبيق موبايل', desc: 'تطبيق متكامل لـ iOS و Android' },
              { icon: Download, title: 'بدون تثبيت', desc: 'لا حاجة لتثبيت برامج - يعمل من المتصفح' },
              { icon: Clock, title: 'دعم 24/7', desc: 'فريق دعم متاح على مدار الساعة' },
            ].map((benefit, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-cyan-400 hover:shadow-xl transition-all duration-300 hover:scale-105 text-center"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <benefit.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.desc}</p>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* How It Works Section - Indigo Theme */}
        <section 
          id="how-it-works" 
          className={`w-full mb-20 lg:mb-32 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-indigo-50 to-purple-50 py-20 ${
            visibleSections.has('how-it-works') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 text-center mb-4">
            كيف يعمل النظام؟
          </h2>
          <p className="text-xl text-gray-700 text-center mb-12 max-w-2xl mx-auto">
            خطوات بسيطة لبدء استخدام المنصة
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: '1',
                icon: UserCheck,
                title: 'إنشاء حساب',
                desc: 'سجل دخولك أو أنشئ حساب جديد في ثوانٍ'
              },
              {
                step: '2',
                icon: Video,
                title: 'إنشاء فصل افتراضي',
                desc: 'أنشئ فصل افتراضي جديد مع الإعدادات المطلوبة'
              },
              {
                step: '3',
                icon: LinkIcon,
                title: 'مشاركة الرابط',
                desc: 'شارك رابط الفصل مع الطلاب والمشاركين'
              },
              {
                step: '4',
                icon: PlayCircle,
                title: 'ابدأ التدريس',
                desc: 'ابدأ الجلسة واستخدم جميع الأدوات المتاحة'
              },
            ].map((step, index) => (
              <div
                key={index}
                className="relative bg-white rounded-2xl p-8 border border-gray-200 hover:border-indigo-400 hover:shadow-xl transition-all duration-300 text-center"
              >
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {step.step}
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600">{step.desc}</p>
                {index < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -left-4 w-8 h-0.5 bg-gray-300 transform -translate-y-1/2">
                    <ChevronRight className="w-4 h-4 text-indigo-400 absolute -right-2 top-1/2 transform -translate-y-1/2" />
                  </div>
                )}
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Contact/CTA Section - Yellow/Amber Theme */}
        <section 
          id="contact" 
          className={`w-full mb-20 lg:mb-32 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-yellow-50 to-amber-50 py-20 ${
            visibleSections.has('contact') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl p-8 lg:p-12 border border-gray-200 shadow-2xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                تواصل معنا
              </h2>
              <p className="text-xl text-gray-700 max-w-2xl mx-auto">
                نحن هنا لمساعدتك! تواصل معنا للحصول على حساب جديد أو للاستفسار عن خدماتنا
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
              <a
                href="mailto:technestagency@gmail.com"
                className="flex items-center gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-200 hover:border-yellow-400 hover:shadow-lg transition-all duration-300 hover:scale-105 group"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-gray-900 font-semibold text-lg mb-1">البريد الإلكتروني</h3>
                  <p className="text-gray-600 text-sm">technestagency@gmail.com</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-yellow-500 group-hover:translate-x-1 transition-all" />
              </a>

              <a
                href="https://wa.me/201557601371"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-200 hover:border-green-400 hover:shadow-lg transition-all duration-300 hover:scale-105 group"
              >
                <div className="w-16 h-16 bg-green-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-gray-900 font-semibold text-lg mb-1">واتساب</h3>
                  <p className="text-gray-600 text-sm">01557601371</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
              </a>
            </div>

            <div className="text-center">
              <Link
                href="/client/login"
                className="inline-flex items-center gap-2 px-8 py-4 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-xl font-semibold text-lg shadow-2xl shadow-yellow-500/50 hover:shadow-yellow-500/70 hover:scale-105 transition-all duration-300"
              >
                <span>ابدأ الآن مجاناً</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
          </div>
        </section>

        {/* Footer - V.CONNCT Style */}
        <footer className="bg-black text-white pt-16 pb-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 mb-12">
              {/* Products */}
              <div>
                <h4 className="text-white font-bold mb-4 text-lg">المنتجات</h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      Academiq-meet Pro
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      Academiq-meet Cloud
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      Academiq-meet Mobile
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Solutions By Industry */}
              <div>
                <h4 className="text-white font-bold mb-4 text-lg">الحلول حسب القطاع</h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      التعليم
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      الصحة
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      المالية
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      التجزئة
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      الحكومة
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      التصنيع
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Solutions By Audience */}
              <div>
                <h4 className="text-white font-bold mb-4 text-lg">الحلول حسب الجمهور</h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      الأكاديميات
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      المدارس
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      مراكز التدريب
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      الدروس الخصوصية
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      العمل الهجين
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      خدمة العملاء
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Resources */}
              <div>
                <h4 className="text-white font-bold mb-4 text-lg">الموارد</h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      المدونة
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      مركز المساعدة
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      مركز الثقة
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      المسرد
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Others */}
              <div>
                <h4 className="text-white font-bold mb-4 text-lg">أخرى</h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      الأسعار والخطط
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      مركز التحميل
                    </Link>
                  </li>
                  <li>
                    <button
                      onClick={() => scrollToSection('contact')}
                      className="text-gray-400 hover:text-yellow-400 transition-colors text-sm"
                    >
                      احجز عرض توضيحي
                    </button>
                  </li>
                  <li>
                    <Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
                      احصل على المساعدة
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer Bottom */}
            <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-gray-800">
              <div className="flex items-center gap-3 mb-4 md:mb-0">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
                  <img 
                    src="/academiq-meet-logo.png" 
                    alt="Academiq-meet Logo" 
                    className="h-8 w-auto object-contain"
                  />
                </div>
                <span className="text-xl font-bold text-white">Academiq-meet</span>
              </div>
              <div className="flex items-center gap-4">
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  <MessageCircle className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  <Mail className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  <Globe className="w-5 h-5" />
                </a>
              </div>
            </div>

            <div className="text-center mt-8">
              <p className="text-gray-500 text-sm">
                © 2024 Academiq-meet. جميع الحقوق محفوظة.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
