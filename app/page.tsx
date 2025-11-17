'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Force dynamic rendering to prevent SSR issues
export const dynamic = 'force-dynamic';
import {
  Video, Users, Shield, Zap, Globe, MessageCircle, Mail, Phone, ArrowRight, CheckCircle, Menu, X,
  GraduationCap, School, BookOpen, UserCheck, Eye, PenTool, FileText, Share2, Mic, Hand,
  Lock, Monitor, Smartphone, Clock, Settings, BarChart3, PlayCircle, Camera, ScreenShare,
  FileImage, Sparkles, Award, TrendingUp, Heart, Star, ChevronRight, Download, Upload,
  Grid3x3, Layers, Eraser, Type, Circle, Square, Triangle, ArrowUpRight, MessageSquare,
  VideoOff, Headphones, Calendar, Bell, Search, Filter, MoreVertical, Copy, Link as LinkIcon,
  Building2, Cloud, Server, Key, Database, Network
} from 'lucide-react';
import Link from 'next/link';

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const referralCode = searchParams?.get('ref');
    if (referralCode) {
      router.replace(`/subscription-request?ref=${encodeURIComponent(referralCode)}`);
    }
  }, [router, searchParams]);

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
    <div dir="rtl" className="w-full relative bg-white" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Modern Header - V.CONNCT Style */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 bg-white shadow-md border-b border-gray-200`}>
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo and Brand */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img 
                  src="/academiq-meet-logo.png" 
                  alt="Academiq-meet Logo" 
                  className="h-16 w-auto object-contain group-hover:scale-110 transition-transform duration-300"
                />
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
                onClick={() => scrollToSection('monitoring')}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all flex items-center gap-1"
              >
                المراقبة
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
                className="mr-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2"
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
                  onClick={() => scrollToSection('monitoring')}
                  className="text-right text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-100 transition-all"
                >
                  المراقبة
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
                  className="mt-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold text-center transition-all"
                >
                  تسجيل الدخول
                </Link>
              </div>
            </div>
          )}
        </nav>
      </header>


      {/* Main Content */}
      <div className="relative z-10" style={{ flex: 1 }}>
        
        {/* Hero Section - Redesigned with Feature Highlights */}
        <section className="w-full mb-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 py-24 lg:py-32 pt-28 relative overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 right-20 w-72 h-72 bg-cyan-400/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-3xl"></div>
            
            {/* LMS Vector Illustration - Left Side */}
            <div className="absolute top-10 left-10 w-96 h-96 opacity-10 pointer-events-none hidden lg:block animate-float-slow" style={{ animation: 'float 7s ease-in-out infinite', animationDelay: '0.3s' }}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 400 400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Graduation Cap */}
                <path
                  d="M200 50L100 120L200 190L300 120L200 50Z"
                  fill="white"
                  opacity="0.4"
                />
                <path
                  d="M100 120L200 190L300 120"
                  stroke="white"
                  strokeWidth="2"
                  opacity="0.5"
                />
                
                {/* Books */}
                <rect x="50" y="220" width="100" height="120" rx="6" fill="white" opacity="0.3" />
                <line x1="100" y1="240" x2="100" y2="320" stroke="white" strokeWidth="1.5" opacity="0.4" />
                <line x1="50" y1="270" x2="150" y2="270" stroke="white" strokeWidth="1.5" opacity="0.4" />
                
                <rect x="150" y="230" width="100" height="120" rx="6" fill="white" opacity="0.3" />
                <line x1="200" y1="250" x2="200" y2="330" stroke="white" strokeWidth="1.5" opacity="0.4" />
                <line x1="150" y1="280" x2="250" y2="280" stroke="white" strokeWidth="1.5" opacity="0.4" />
                
                <rect x="250" y="220" width="100" height="120" rx="6" fill="white" opacity="0.3" />
                <line x1="300" y1="240" x2="300" y2="320" stroke="white" strokeWidth="1.5" opacity="0.4" />
                <line x1="250" y1="270" x2="350" y2="270" stroke="white" strokeWidth="1.5" opacity="0.4" />
                
                {/* Certificate */}
                <rect x="120" y="120" width="160" height="100" rx="3" fill="white" opacity="0.25" />
                <circle cx="200" cy="150" r="15" fill="white" opacity="0.3" />
                <line x1="140" y1="190" x2="260" y2="190" stroke="white" strokeWidth="1.5" opacity="0.4" />
                
                {/* Stars */}
                <circle cx="60" cy="180" r="2" fill="white" opacity="0.6" />
                <circle cx="340" cy="200" r="2" fill="white" opacity="0.6" />
              </svg>
            </div>
            
            {/* Meetings Vector Illustration - Right Side */}
            <div className="absolute bottom-10 right-10 w-96 h-96 opacity-10 pointer-events-none hidden lg:block animate-float-slow" style={{ animation: 'float 8s ease-in-out infinite' }}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 400 400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Video Conference Screen */}
                <rect x="50" y="80" width="300" height="200" rx="8" fill="white" opacity="0.2" stroke="white" strokeWidth="2" />
                <rect x="70" y="100" width="80" height="60" rx="4" fill="white" opacity="0.3" />
                <rect x="170" y="100" width="80" height="60" rx="4" fill="white" opacity="0.3" />
                <rect x="270" y="100" width="80" height="60" rx="4" fill="white" opacity="0.3" />
                <rect x="70" y="180" width="80" height="60" rx="4" fill="white" opacity="0.3" />
                <rect x="170" y="180" width="80" height="60" rx="4" fill="white" opacity="0.3" />
                <rect x="270" y="180" width="80" height="60" rx="4" fill="white" opacity="0.3" />
                
                {/* Microphone Icon */}
                <path
                  d="M200 300 L200 320 M190 320 L210 320 M195 300 L195 310 M205 300 L205 310"
                  stroke="white"
                  strokeWidth="2"
                  opacity="0.4"
                />
                <circle cx="200" cy="290" r="8" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
                
                {/* Camera Icon */}
                <rect x="250" y="285" width="30" height="20" rx="2" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
                <circle cx="265" cy="295" r="4" fill="white" opacity="0.4" />
                
                {/* Share Screen Icon */}
                <rect x="120" y="285" width="30" height="20" rx="2" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
                <path d="M135 290 L125 295 L135 300" stroke="white" strokeWidth="2" opacity="0.4" fill="none" />
                
                {/* Connection Lines */}
                <path
                  d="M100 50 Q150 80 200 100 T300 120"
                  stroke="white"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.3"
                  strokeDasharray="4,4"
                />
                
                {/* Users/People */}
                <circle cx="100" cy="50" r="12" fill="white" opacity="0.3" />
                <path d="M85 70 Q100 75 115 70" stroke="white" strokeWidth="2" opacity="0.3" fill="none" />
                
                <circle cx="200" cy="40" r="12" fill="white" opacity="0.3" />
                <path d="M185 60 Q200 65 215 60" stroke="white" strokeWidth="2" opacity="0.3" fill="none" />
                
                <circle cx="300" cy="50" r="12" fill="white" opacity="0.3" />
                <path d="M285 70 Q300 75 315 70" stroke="white" strokeWidth="2" opacity="0.3" fill="none" />
              </svg>
            </div>

            {/* Animated Floating Geometric Shapes */}
            <div className="absolute top-1/4 left-1/4 w-32 h-32 opacity-15 pointer-events-none animate-spin-slow" style={{ animation: 'spin 20s linear infinite' }}>
              <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="50,10 90,50 50,90 10,50" fill="white" opacity="0.3" />
                <circle cx="50" cy="50" r="20" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
              </svg>
            </div>

            <div className="absolute bottom-1/4 right-1/4 w-24 h-24 opacity-15 pointer-events-none animate-spin-reverse" style={{ animation: 'spin 15s linear infinite reverse' }}>
              <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="30" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
                <path d="M50,20 L50,80 M20,50 L80,50" stroke="white" strokeWidth="2" opacity="0.4" />
              </svg>
            </div>

            {/* Animated Connection Network */}
            <div className="absolute top-1/3 right-1/3 w-64 h-64 opacity-10 pointer-events-none hidden lg:block animate-pulse-slow" style={{ animation: 'pulse 4s ease-in-out infinite' }}>
              <svg width="100%" height="100%" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Network Nodes */}
                <circle cx="50" cy="50" r="8" fill="white" opacity="0.5" />
                <circle cx="150" cy="50" r="8" fill="white" opacity="0.5" />
                <circle cx="100" cy="100" r="8" fill="white" opacity="0.5" />
                <circle cx="50" cy="150" r="8" fill="white" opacity="0.5" />
                <circle cx="150" cy="150" r="8" fill="white" opacity="0.5" />
                
                {/* Connection Lines */}
                <line x1="50" y1="50" x2="100" y2="100" stroke="white" strokeWidth="1.5" opacity="0.3" />
                <line x1="150" y1="50" x2="100" y2="100" stroke="white" strokeWidth="1.5" opacity="0.3" />
                <line x1="50" y1="150" x2="100" y2="100" stroke="white" strokeWidth="1.5" opacity="0.3" />
                <line x1="150" y1="150" x2="100" y2="100" stroke="white" strokeWidth="1.5" opacity="0.3" />
                <line x1="50" y1="50" x2="150" y2="50" stroke="white" strokeWidth="1" opacity="0.2" />
                <line x1="50" y1="150" x2="150" y2="150" stroke="white" strokeWidth="1" opacity="0.2" />
              </svg>
            </div>

            {/* Animated Whiteboard/Education Tools */}
            <div className="absolute bottom-1/3 left-1/3 w-48 h-48 opacity-10 pointer-events-none hidden lg:block animate-float" style={{ animation: 'float 7s ease-in-out infinite', animationDelay: '0.5s' }}>
              <svg width="100%" height="100%" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Whiteboard */}
                <rect x="10" y="20" width="130" height="90" rx="4" fill="white" opacity="0.2" stroke="white" strokeWidth="2" />
                {/* Drawing Lines */}
                <path d="M20 40 Q40 50 60 40 T100 40" stroke="white" strokeWidth="2" opacity="0.4" fill="none" />
                <path d="M20 70 Q50 60 80 70 T130 70" stroke="white" strokeWidth="2" opacity="0.4" fill="none" />
                <circle cx="40" cy="90" r="8" fill="white" opacity="0.3" />
                <rect x="80" y="85" width="20" height="15" rx="2" fill="white" opacity="0.3" />
                {/* Pen */}
                <path d="M120 10 L130 25 L125 30 L115 15 Z" fill="white" opacity="0.4" />
              </svg>
            </div>

            {/* Animated Stars/Sparkles */}
            <div className="absolute top-1/2 right-1/4 w-40 h-40 opacity-20 pointer-events-none animate-pulse" style={{ animation: 'pulse 3s ease-in-out infinite', animationDelay: '1s' }}>
              <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50,10 L52,35 L75,35 L55,50 L60,75 L50,60 L40,75 L45,50 L25,35 L48,35 Z" fill="white" opacity="0.6" />
                <circle cx="20" cy="20" r="2" fill="white" opacity="0.8" />
                <circle cx="80" cy="30" r="1.5" fill="white" opacity="0.8" />
                <circle cx="30" cy="80" r="1.5" fill="white" opacity="0.8" />
                <circle cx="70" cy="70" r="2" fill="white" opacity="0.8" />
              </svg>
            </div>

            {/* Animated Data Flow */}
            <div className="absolute top-2/3 left-1/2 w-56 h-56 opacity-10 pointer-events-none hidden lg:block animate-float-slow" style={{ animation: 'float 9s ease-in-out infinite', animationDelay: '1.5s' }}>
              <svg width="100%" height="100%" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Data Flow Arrows */}
                <path d="M10 75 L50 75 M45 70 L50 75 L45 80" stroke="white" strokeWidth="2" opacity="0.4" fill="none" />
                <path d="M100 75 L140 75 M135 70 L140 75 L135 80" stroke="white" strokeWidth="2" opacity="0.4" fill="none" />
                <path d="M75 10 L75 50 M70 45 L75 50 L80 45" stroke="white" strokeWidth="2" opacity="0.4" fill="none" />
                <path d="M75 100 L75 140 M70 135 L75 140 L80 135" stroke="white" strokeWidth="2" opacity="0.4" fill="none" />
                {/* Center Node */}
                <circle cx="75" cy="75" r="12" fill="white" opacity="0.3" />
                <circle cx="75" cy="75" r="6" fill="white" opacity="0.5" />
                {/* Data Packets */}
                <rect x="20" y="70" width="15" height="10" rx="2" fill="white" opacity="0.3" />
                <rect x="115" y="70" width="15" height="10" rx="2" fill="white" opacity="0.3" />
                <rect x="70" y="20" width="10" height="15" rx="2" fill="white" opacity="0.3" />
                <rect x="70" y="115" width="10" height="15" rx="2" fill="white" opacity="0.3" />
              </svg>
            </div>

            {/* Animated Learning Path */}
            <div className="absolute bottom-1/4 left-1/2 w-72 h-72 opacity-10 pointer-events-none hidden lg:block animate-float" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '2s' }}>
              <svg width="100%" height="100%" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Curved Learning Path */}
                <path d="M20 180 Q50 150 80 120 T140 60 Q160 40 180 20" stroke="white" strokeWidth="2" opacity="0.4" fill="none" strokeDasharray="5,5" />
                {/* Progress Points */}
                <circle cx="20" cy="180" r="6" fill="white" opacity="0.5" />
                <circle cx="80" cy="120" r="6" fill="white" opacity="0.5" />
                <circle cx="140" cy="60" r="6" fill="white" opacity="0.5" />
                <circle cx="180" cy="20" r="6" fill="white" opacity="0.5" />
                {/* Checkmarks */}
                <path d="M15 180 L18 183 L25 176" stroke="white" strokeWidth="2" opacity="0.6" fill="none" />
                <path d="M75 120 L78 123 L85 116" stroke="white" strokeWidth="2" opacity="0.6" fill="none" />
              </svg>
            </div>

            {/* Animated Particles */}
            <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
              {[
                { size: 3, left: 15, top: 20, duration: 4, delay: 0 },
                { size: 2.5, left: 85, top: 15, duration: 5, delay: 0.3 },
                { size: 4, left: 25, top: 60, duration: 6, delay: 0.6 },
                { size: 3.5, left: 75, top: 55, duration: 4.5, delay: 0.9 },
                { size: 2, left: 45, top: 80, duration: 5.5, delay: 1.2 },
                { size: 3, left: 90, top: 75, duration: 4, delay: 1.5 },
                { size: 2.5, left: 10, top: 40, duration: 6, delay: 0.2 },
                { size: 4, left: 60, top: 35, duration: 5, delay: 0.5 },
                { size: 3, left: 30, top: 10, duration: 4.5, delay: 0.8 },
                { size: 2.5, left: 70, top: 90, duration: 5.5, delay: 1.1 },
                { size: 3.5, left: 50, top: 50, duration: 6, delay: 1.4 },
                { size: 2, left: 95, top: 30, duration: 4, delay: 1.7 },
              ].map((particle, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white"
                  style={{
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                    left: `${particle.left}%`,
                    top: `${particle.top}%`,
                    animation: `float ${particle.duration}s ease-in-out infinite`,
                    animationDelay: `${particle.delay}s`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-6xl mx-auto">
              {/* Centered Content */}
              <div className="text-center space-y-8">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full mb-4">
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                  <span className="text-sm font-semibold text-white">منصة متكاملة للتعليم الإلكتروني الاحترافي</span>
                </div>
                
                {/* Main Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-tight">
                  <span className="block text-white mb-3">منصة</span>
                  <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent mb-3">
                    Academiq-meet
                  </span>
                  <span className="block text-white text-3xl sm:text-4xl lg:text-5xl mt-2">لإدارة اجتماعاتك ومحاضراتك ودروسك</span>
                </h1>
                
                {/* Subheadline */}
                <p className="text-lg sm:text-xl lg:text-2xl text-white/90 leading-relaxed max-w-3xl mx-auto">
                  حل متكامل وحديث لإدارة اجتماعاتك ومحاضراتك ودروسك الافتراضية بسهولة وأمان تام. منصة شاملة للأكاديميات والمدارس ومراكز التدريب مع مميزات متقدمة للتعليم الحديث
                </p>
                
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
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

                {/* Encouraging Client-Focused Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 pt-12 max-w-5xl mx-auto">
                  {[
                    { 
                      icon: TrendingUp, 
                      title: 'طور مؤسستك', 
                      desc: 'ارتق بمستوى التعليم',
                      color: 'from-emerald-400 to-teal-500' 
                    },
                    { 
                      icon: Users, 
                      title: 'انضم للآلاف', 
                      desc: 'مؤسسات تثق بنا',
                      color: 'from-blue-400 to-indigo-500' 
                    },
                    { 
                      icon: Award, 
                      title: 'اضمن النجاح', 
                      desc: 'مع أدوات متقدمة',
                      color: 'from-yellow-400 to-orange-500' 
                    },
                    { 
                      icon: Zap, 
                      title: 'ابدأ الآن', 
                      desc: 'في دقائق معدودة',
                      color: 'from-purple-400 to-pink-500' 
                    },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="group relative bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 lg:p-6 hover:bg-white/20 hover:scale-110 transition-all duration-300 animate-float"
                      style={{ 
                        animationDelay: `${index * 0.2}s`,
                        animation: 'float 6s ease-in-out infinite'
                      }}
                    >
                      <div className={`w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                        <item.icon className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
                      </div>
                      <h3 className="text-sm lg:text-base font-bold text-white text-center mb-1">{item.title}</h3>
                      <p className="text-xs lg:text-sm text-white/80 text-center">{item.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-12 border-t border-white/20 max-w-4xl mx-auto">
                  <div>
                    <div className="text-3xl lg:text-4xl font-bold text-cyan-300">30+</div>
                    <div className="text-sm text-white/80">ميزة متقدمة</div>
                  </div>
                  <div>
                    <div className="text-3xl lg:text-4xl font-bold text-cyan-300">100%</div>
                    <div className="text-sm text-white/80">آمن ومحمي</div>
                  </div>
                  <div>
                    <div className="text-3xl lg:text-4xl font-bold text-cyan-300">24/7</div>
                    <div className="text-sm text-white/80">دعم فني</div>
                  </div>
                  <div>
                    <div className="text-3xl lg:text-4xl font-bold text-cyan-300">∞</div>
                    <div className="text-sm text-white/80">قابل للتوسع</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-20px); }
            }
            @keyframes float-slow {
              0%, 100% { transform: translateY(0px) translateX(0px); }
              33% { transform: translateY(-15px) translateX(10px); }
              66% { transform: translateY(-10px) translateX(-10px); }
            }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes pulse-slow {
              0%, 100% { opacity: 0.1; transform: scale(1); }
              50% { opacity: 0.2; transform: scale(1.1); }
            }
            .animate-float-slow {
              animation: float-slow 8s ease-in-out infinite;
            }
            .animate-spin-slow {
              animation: spin 20s linear infinite;
            }
            .animate-spin-reverse {
              animation: spin 15s linear infinite reverse;
            }
            .animate-pulse-slow {
              animation: pulse-slow 4s ease-in-out infinite;
            }
          `}</style>
        </section>

        {/* Features Showcase Section - Categorized */}
        <section 
          id="features" 
          className={`w-full mb-0 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-blue-50 to-indigo-50 pt-0 pb-20 ${
            visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16 pt-8">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                مميزات متقدمة للتعليم الإلكتروني
              </h2>
              <p className="text-xl text-gray-700 max-w-2xl mx-auto">
                مجموعة شاملة من الأدوات والمميزات المصممة خصيصاً لتحسين تجربة التعليم الإلكتروني
              </p>
            </div>

            {/* Core Meeting Features */}
            <div className="mb-16">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900">مميزات الاجتماعات الأساسية</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: Video, title: 'اجتماعات مرئية عالية الجودة', desc: 'جودة صوت وصورة استثنائية مع دعم لأعداد كبيرة من المشاركين' },
                  { icon: Mic, title: 'صوت عالي الجودة', desc: 'تقنية إلغاء الضوضاء وجودة صوت استثنائية' },
                  { icon: ScreenShare, title: 'مشاركة الشاشة', desc: 'شارك شاشتك بسهولة مع جميع المشاركين' },
                  { icon: PlayCircle, title: 'تسجيل الجلسات', desc: 'سجل جميع الجلسات بجودة عالية مع إمكانية المشاهدة لاحقاً' },
                ].map((feature, index) => (
                  <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 hover:scale-105 group">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Tools */}
            <div className="mb-16">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <PenTool className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900">أدوات تفاعلية متقدمة</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: PenTool, title: 'سبورة تفاعلية تعاونية', desc: 'سبورة تفاعلية متقدمة للرسم والكتابة والتعاون في الوقت الفعلي', badge: 'جديد' },
                  { icon: Layers, title: 'سبورة عادية متقدمة', desc: 'سبورة شخصية مع أدوات متقدمة للرسم والأشكال والنصوص', badge: 'جديد' },
                  { icon: ScreenShare, title: 'مشاركة الشاشة والتعليق', desc: 'شارك شاشتك مع إمكانية التعليق والرسم عليها مباشرة' },
                  { icon: FileImage, title: 'عارض PDF متقدم', desc: 'عرض ملفات PDF مباشرة داخل الجلسة مع أدوات التعليق والرسم', badge: 'جديد' },
                ].map((feature, index) => (
                  <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all duration-300 hover:scale-105 group relative">
                    {feature.badge && (
                      <span className="absolute top-4 left-4 px-2 py-1 bg-purple-100 text-purple-600 text-xs font-bold rounded-full">
                        {feature.badge}
                      </span>
                    )}
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Monitoring & Management */}
            <div className="mb-16">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900">المراقبة والإدارة</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: Eye, title: 'وضع المراقب الصامت', desc: 'مراقبة الجلسات بشكل سري تماماً دون ظهور للمشاركين - مثالي لمراقبة جودة التدريس', badge: 'حصري' },
                  { icon: Monitor, title: 'مراقبة الطلاب PiP', desc: 'ميزة Picture-in-Picture لمراقبة جميع الطلاب في نافذة منفصلة أثناء مشاركة الشاشة', badge: 'جديد' },
                  { icon: UserCheck, title: 'غرفة الانتظار', desc: 'تحكم كامل في دخول المشاركين مع نظام موافقة متقدم' },
                  { icon: Users, title: 'إدارة المشاركين', desc: 'تحكم كامل في المشاركين والصلاحيات والإعدادات' },
                ].map((feature, index) => (
                  <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-emerald-400 hover:shadow-xl transition-all duration-300 hover:scale-105 group relative">
                    {feature.badge && (
                      <span className="absolute top-4 left-4 px-2 py-1 bg-emerald-100 text-emerald-600 text-xs font-bold rounded-full">
                        {feature.badge}
                      </span>
                    )}
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Security & Privacy */}
            <div className="mb-16">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900">الأمان والخصوصية</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: Lock, title: 'تشفير من طرف إلى طرف', desc: 'حماية كاملة للبيانات مع تشفير E2EE متقدم - جميع الاتصالات مشفرة', badge: 'مميز' },
                  { icon: Shield, title: 'أمان متقدم', desc: 'نظام أمان متعدد الطبقات لحماية الجلسات والبيانات' },
                  { icon: Settings, title: 'إعدادات أمان متقدمة', desc: 'تخصيص إعدادات الأمان حسب احتياجاتك' },
                  { icon: UserCheck, title: 'تحكم في الوصول', desc: 'نظام صلاحيات متقدم مع غرف انتظار وموافقات' },
                ].map((feature, index) => (
                  <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-orange-400 hover:shadow-xl transition-all duration-300 hover:scale-105 group relative">
                    {feature.badge && (
                      <span className="absolute top-4 left-4 px-2 py-1 bg-orange-100 text-orange-600 text-xs font-bold rounded-full">
                        {feature.badge}
                      </span>
                    )}
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Features */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900">مميزات المنصة</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: Smartphone, title: 'تطبيق موبايل', desc: 'تطبيق موبايل متكامل لنظام iOS و Android مع جميع المميزات', badge: 'جديد' },
                  { icon: Globe, title: 'متوافق مع جميع الأجهزة', desc: 'يعمل على جميع المتصفحات والأجهزة بدون تثبيت' },
                  { icon: FileText, title: 'مشاركة الملفات', desc: 'شارك الملفات والوثائق بسهولة مع جميع المشاركين' },
                  { icon: Sparkles, title: 'التفاعلات', desc: 'تفاعل مع المحتوى باستخدام الإيموجي والتفاعلات المباشرة' },
                  { icon: Hand, title: 'رفع اليد', desc: 'نظام رفع اليد للمشاركة والتفاعل المنظم' },
                  { icon: MessageSquare, title: 'دردشة خاصة', desc: 'دردشة عامة وخاصة مع جميع المشاركين' },
                  { icon: Camera, title: 'خلفيات افتراضية', desc: 'استخدم خلفيات افتراضية احترافية لتحسين المظهر' },
                  { icon: Mic, title: 'إلغاء كتم الضيوف', desc: 'السماح للضيوف بإلغاء كتم الصوت بأنفسهم' },
                ].map((feature, index) => (
                  <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-cyan-400 hover:shadow-xl transition-all duration-300 hover:scale-105 group relative">
                    {feature.badge && (
                      <span className="absolute top-4 left-4 px-2 py-1 bg-cyan-100 text-cyan-600 text-xs font-bold rounded-full">
                        {feature.badge}
                      </span>
                    )}
                    <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Monitoring & Quality Assurance Section - New */}
        <section 
          id="monitoring" 
          className={`w-full mb-0 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-slate-50 to-gray-50 pt-0 pb-20 ${
            visibleSections.has('monitoring') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl p-8 lg:p-12 border border-gray-200 shadow-2xl">
              <div className="text-center mb-12 pt-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-300 rounded-full mb-4">
                  <Eye className="w-5 h-5 text-slate-600" />
                  <span className="text-slate-600 font-semibold">مراقبة وجودة التدريس</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                  المراقبة وضمان الجودة
                </h2>
                <p className="text-xl text-gray-700 max-w-2xl mx-auto">
                  أدوات متقدمة لمراقبة جودة التدريس وضمان أفضل تجربة تعليمية
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border border-emerald-200">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                      <Eye className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">وضع المراقب الصامت</h3>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-600 text-sm font-bold rounded-full">حصري</span>
                    </div>
                  </div>
                  <p className="text-gray-700 text-lg mb-6 leading-relaxed">
                    مراقبة الجلسات بشكل كامل وسري تماماً دون ظهور للمشاركين. مثالي لمراقبة جودة التدريس وضمان معايير التعليم العالية.
                  </p>
                  <ul className="space-y-3">
                    {[
                      'مراقبة غير مرئية تماماً',
                      'وصول كامل للصوت والصورة',
                      'مثالي لمراقبة الجودة',
                      'دعم متعدد المراقبين'
                    ].map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 border border-indigo-200">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                      <Monitor className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">مراقبة الطلاب PiP</h3>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-600 text-sm font-bold rounded-full">جديد</span>
                    </div>
                  </div>
                  <p className="text-gray-700 text-lg mb-6 leading-relaxed">
                    ميزة Picture-in-Picture لمراقبة جميع الطلاب في نافذة منفصلة أثناء مشاركة الشاشة. مثالي للمعلمين أثناء الشرح.
                  </p>
                  <ul className="space-y-3">
                    {[
                      'نافذة منفصلة للمراقبة',
                      'يعمل أثناء مشاركة الشاشة',
                      'مراقبة متعددة الطلاب',
                      'سهولة التبديل بين الطلاب'
                    ].map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 border border-blue-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">فوائد المراقبة المتقدمة</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { title: 'ضمان الجودة', desc: 'مراقبة جودة التدريس وضمان معايير عالية' },
                    { title: 'تحسين الأداء', desc: 'تحديد نقاط التحسين وتطوير المهارات' },
                    { title: 'إدارة أفضل', desc: 'إدارة شاملة للفصول والجلسات التعليمية' },
                  ].map((benefit, idx) => (
                    <div key={idx} className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Award className="w-6 h-6 text-white" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 mb-2">{benefit.title}</h4>
                      <p className="text-gray-600 text-sm">{benefit.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases Section - Restructured */}
        <section 
          id="use-cases" 
          className={`w-full mb-0 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-emerald-50 to-teal-50 pt-0 pb-20 ${
            visibleSections.has('use-cases') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center pt-8">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                مثالي للأكاديميات والمدارس
              </h2>
              <p className="text-xl text-gray-700 mb-12 max-w-2xl mx-auto">
                حل متكامل مصمم خصيصاً لاحتياجات المؤسسات التعليمية
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
              {[
                {
                  icon: Eye,
                  title: 'ضمان الجودة والمراقبة',
                  desc: 'استخدم وضع المراقب الصامت ومراقبة PiP لضمان جودة التدريس ومراقبة الفصول بشكل احترافي',
                  features: ['مراقب صامت', 'مراقبة PiP', 'ضمان الجودة', 'تقارير المراقبة'],
                  badge: 'جديد'
                },
                {
                  icon: Building2,
                  title: 'إدارة الأكاديميات',
                  desc: 'إدارة فصول افتراضية متعددة مع تتبع الطلاب والتقارير التفصيلية ونظام متعدد المستأجرين',
                  features: ['فصول متعددة', 'تتبع الحضور', 'تقارير مفصلة', 'نظام متعدد المستأجرين']
                },
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
                  className="bg-white rounded-3xl p-8 lg:p-10 border border-gray-200 hover:border-emerald-400 hover:shadow-xl transition-all duration-300 hover:scale-105 relative"
                >
                  {useCase.badge && (
                    <span className="absolute top-4 left-4 px-3 py-1 bg-emerald-100 text-emerald-600 text-sm font-bold rounded-full">
                      {useCase.badge}
                    </span>
                  )}
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


        {/* Platform Capabilities Section - New */}
        <section 
          id="platform-capabilities" 
          className={`w-full mb-0 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-slate-50 to-gray-50 pt-0 pb-20 ${
            visibleSections.has('platform-capabilities') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl p-8 lg:p-12 border border-gray-200 shadow-2xl">
              <div className="text-center mb-12 pt-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-300 rounded-full mb-4">
                  <Cloud className="w-5 h-5 text-slate-600" />
                  <span className="text-slate-600 font-semibold">قدرات المنصة</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                  منصة SaaS متكاملة
                </h2>
                <p className="text-xl text-gray-700 max-w-2xl mx-auto">
                  نظام متعدد المستأجرين مع إدارة اشتراكات ومميزات متقدمة
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    icon: Building2,
                    title: 'نظام متعدد المستأجرين',
                    desc: 'إدارة متعددة للمؤسسات مع عزل كامل للبيانات',
                    color: 'from-blue-500 to-indigo-500'
                  },
                  {
                    icon: Key,
                    title: 'إدارة الاشتراكات',
                    desc: 'نظام اشتراكات متقدم مع خطط مرنة وإدارة فواتير',
                    color: 'from-purple-500 to-pink-500'
                  },
                  {
                    icon: Settings,
                    title: 'مميزات قائمة على الاشتراك',
                    desc: 'تفعيل وتعطيل المميزات حسب خطة الاشتراك',
                    color: 'from-emerald-500 to-teal-500'
                  },
                  {
                    icon: Server,
                    title: 'قابلية التوسع',
                    desc: 'بنية تحتية قابلة للتوسع لدعم أي عدد من المستخدمين',
                    color: 'from-orange-500 to-amber-500'
                  },
                  {
                    icon: Database,
                    title: 'إدارة البيانات',
                    desc: 'إدارة شاملة للبيانات مع نسخ احتياطي تلقائي',
                    color: 'from-cyan-500 to-blue-500'
                  },
                  {
                    icon: Network,
                    title: 'تكامل API',
                    desc: 'واجهات برمجية متقدمة للتكامل مع الأنظمة الأخرى',
                    color: 'from-indigo-500 to-purple-500'
                  },
                ].map((capability, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-300 group"
                  >
                    <div className={`w-14 h-14 bg-gradient-to-br ${capability.color} rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                      <capability.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{capability.title}</h3>
                    <p className="text-gray-600 text-sm">{capability.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section - Updated */}
        <section 
          id="how-it-works" 
          className={`w-full mb-0 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-indigo-50 to-purple-50 pt-0 pb-20 ${
            visibleSections.has('how-it-works') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center pt-8">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                كيف يعمل النظام؟
              </h2>
              <p className="text-xl text-gray-700 mb-12 max-w-2xl mx-auto">
                خطوات بسيطة لبدء استخدام المنصة
              </p>
            </div>

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
                  desc: 'شارك رابط الفصل مع الطلاب والمشاركين أو رابط المراقب'
                },
                {
                  step: '4',
                  icon: PlayCircle,
                  title: 'ابدأ التدريس',
                  desc: 'ابدأ الجلسة واستخدم جميع الأدوات المتاحة - سبورة، تسجيل، مراقبة'
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

            {/* Additional Info */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
                <Smartphone className="w-8 h-8 text-indigo-500 mx-auto mb-3" />
                <h4 className="font-bold text-gray-900 mb-2">تطبيق موبايل</h4>
                <p className="text-gray-600 text-sm">استخدم التطبيق على iOS أو Android</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
                <Eye className="w-8 h-8 text-indigo-500 mx-auto mb-3" />
                <h4 className="font-bold text-gray-900 mb-2">مراقب صامت</h4>
                <p className="text-gray-600 text-sm">استخدم رابط المراقب لمراقبة الجلسات</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
                <Monitor className="w-8 h-8 text-indigo-500 mx-auto mb-3" />
                <h4 className="font-bold text-gray-900 mb-2">مراقبة PiP</h4>
                <p className="text-gray-600 text-sm">راقب الطلاب أثناء مشاركة الشاشة</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact/CTA Section - Yellow/Amber Theme */}
        <section 
          id="contact" 
          className={`w-full mb-0 scroll-mt-20 transition-all duration-1000 bg-gradient-to-br from-yellow-50 to-amber-50 pt-0 pb-20 ${
            visibleSections.has('contact') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl p-8 lg:p-12 border border-gray-200 shadow-2xl">
            <div className="text-center mb-12 pt-8">
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

        {/* Footer - Modern Professional Design */}
        <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white mt-auto" style={{ marginBottom: 0, marginTop: 'auto' }}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-10">
              {/* Logo and Brand Section */}
              <div className="flex flex-col items-center lg:items-start">
                <div className="flex items-center gap-4 mb-6">
                  <img 
                    src="/academiq-meet-logo.png" 
                    alt="Academiq-meet Logo" 
                    className="h-20 w-auto object-contain"
                  />
                  <span className="text-2xl font-bold text-white">Academiq-meet</span>
                </div>
                <p className="text-gray-400 text-sm text-center lg:text-right leading-relaxed max-w-xs">
                  منصة متكاملة لإدارة الاجتماعات والمحاضرات والدروس الإلكترونية
                </p>
              </div>

              {/* Contact Information - Professional Layout */}
              <div className="flex flex-col gap-6">
                <h3 className="text-lg font-bold text-white mb-2 border-b border-gray-700 pb-2">تواصل معنا</h3>
                <div className="space-y-4">
                  <a 
                    href="tel:+20207220414" 
                    className="flex items-center gap-4 group hover:translate-x-[-4px] transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 text-xs mb-1">الهاتف</p>
                      <p className="text-white font-semibold">+20207220414</p>
                    </div>
                  </a>
                  
                  <a 
                    href="mailto:technestagency@gmail.com" 
                    className="flex items-center gap-4 group hover:translate-x-[-4px] transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 text-xs mb-1">البريد الإلكتروني</p>
                      <p className="text-white font-semibold break-all">technestagency@gmail.com</p>
                    </div>
                  </a>
                </div>
              </div>

              {/* Social Media and WhatsApp */}
              <div className="flex flex-col gap-6">
                <h3 className="text-lg font-bold text-white mb-2 border-b border-gray-700 pb-2">وسائل التواصل</h3>
                <div className="space-y-4">
                  <a 
                    href="https://wa.me/201557601371" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 group hover:translate-x-[-4px] transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 text-xs mb-1">واتساب</p>
                      <p className="text-white font-semibold">+201557601371</p>
                    </div>
                  </a>
                  
                  <a 
                    href="https://www.facebook.com/profile.php?id=61571489512337" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 group hover:translate-x-[-4px] transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Globe className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 text-xs mb-1">فيسبوك</p>
                      <p className="text-white font-semibold">صفحتنا على فيسبوك</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-700 my-8"></div>

            {/* Copyright */}
            <div className="text-center">
              <p className="text-gray-400 text-sm">
                © 2024 Academiq-meet. جميع الحقوق محفوظة.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
