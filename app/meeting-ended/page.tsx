'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function MeetingEndedPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation
    setIsVisible(true);
  }, []);

  return (
    <div 
      dir="rtl" 
      className="w-full relative bg-white" 
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-cyan-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-3xl"></div>
        
        {/* Animated Particles */}
        <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
          {[
            { size: 3, left: 15, top: 20, duration: 4, delay: 0 },
            { size: 2.5, left: 85, top: 15, duration: 5, delay: 0.3 },
            { size: 4, left: 25, top: 60, duration: 6, delay: 0.6 },
            { size: 3.5, left: 75, top: 55, duration: 4.5, delay: 0.9 },
            { size: 2, left: 45, top: 80, duration: 5.5, delay: 1.2 },
            { size: 3, left: 90, top: 75, duration: 4, delay: 1.5 },
          ].map((particle, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-blue-400"
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

        {/* Scattered Emojis Across Screen */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top area emojis */}
          <div className="absolute top-[5%] left-[8%] text-4xl animate-float-slow opacity-30" style={{ animation: 'float 5s ease-in-out infinite', animationDelay: '0s' }}>
            🎓
          </div>
          <div className="absolute top-[12%] right-[15%] text-3xl animate-float-slow opacity-30" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '0.5s' }}>
            📖
          </div>
          <div className="absolute top-[8%] left-[45%] text-3xl animate-float-slow opacity-30" style={{ animation: 'float 7s ease-in-out infinite', animationDelay: '1s' }}>
            ✨
          </div>
          
          {/* Middle-left area emojis */}
          <div className="absolute top-[25%] left-[5%] text-4xl animate-float-slow opacity-30" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '0.3s' }}>
            🎨
          </div>
          <div className="absolute top-[35%] left-[12%] text-3xl animate-float-slow opacity-30" style={{ animation: 'float 5.5s ease-in-out infinite', animationDelay: '0.8s' }}>
            🧮
          </div>
          <div className="absolute top-[45%] left-[8%] text-3xl animate-float-slow opacity-30" style={{ animation: 'float 6.5s ease-in-out infinite', animationDelay: '1.2s' }}>
            🎯
          </div>
          
          {/* Middle-right area emojis */}
          <div className="absolute top-[30%] right-[8%] text-4xl animate-float-slow opacity-30" style={{ animation: 'float 5.5s ease-in-out infinite', animationDelay: '0.4s' }}>
            💡
          </div>
          <div className="absolute top-[40%] right-[12%] text-3xl animate-float-slow opacity-30" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '0.9s' }}>
            🌟
          </div>
          <div className="absolute top-[50%] right-[6%] text-3xl animate-float-slow opacity-30" style={{ animation: 'float 7s ease-in-out infinite', animationDelay: '1.3s' }}>
            ⭐
          </div>
          
          {/* Bottom area emojis */}
          <div className="absolute bottom-[15%] left-[10%] text-4xl animate-float-slow opacity-30" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '0.6s' }}>
            🎪
          </div>
          <div className="absolute bottom-[25%] left-[15%] text-3xl animate-float-slow opacity-30" style={{ animation: 'float 5.5s ease-in-out infinite', animationDelay: '1.1s' }}>
            🎭
          </div>
          <div className="absolute bottom-[20%] right-[10%] text-4xl animate-float-slow opacity-30" style={{ animation: 'float 6.5s ease-in-out infinite', animationDelay: '0.7s' }}>
            🏆
          </div>
          <div className="absolute bottom-[30%] right-[14%] text-3xl animate-float-slow opacity-30" style={{ animation: 'float 5s ease-in-out infinite', animationDelay: '1.4s' }}>
            🎁
          </div>
          
          {/* Center area emojis */}
          <div className="absolute top-[50%] left-[20%] -translate-y-1/2 text-3xl animate-float-slow opacity-30" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '0.2s' }}>
            🎈
          </div>
          <div className="absolute top-[50%] right-[20%] -translate-y-1/2 text-3xl animate-float-slow opacity-30" style={{ animation: 'float 5.5s ease-in-out infinite', animationDelay: '0.9s' }}>
            🎊
          </div>
          <div className="absolute top-[60%] left-[50%] -translate-x-1/2 text-3xl animate-float-slow opacity-30" style={{ animation: 'float 6.5s ease-in-out infinite', animationDelay: '1.1s' }}>
            🎉
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div 
          className={`w-full max-w-2xl mx-auto text-center transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center justify-center">
            <div className="relative mb-4">
              <img 
                src="/academiq-meet-logo.png" 
                alt="Academiq-meet Logo" 
                className="h-24 sm:h-32 w-auto object-contain mx-auto animate-float"
              />
            </div>
            {/* App Name */}
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Academiq-meet
            </h2>
          </div>

          {/* Main Message */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4 leading-tight">
            <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              شكراً لك
            </span>
            <span className="block text-gray-800 text-2xl sm:text-3xl lg:text-4xl">
              Thank you for joining
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-xl mx-auto leading-relaxed">
            نأمل أن تكون قد استمتعت بالاجتماع. نراك قريباً!
          </p>

          {/* Return Home Button */}
          <div className="mt-10">
            <Link
              href="/"
              className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-lg shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 transition-all duration-300"
            >
              <span>العودة إلى الصفحة الرئيسية</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Decorative Elements */}
          <div className="mt-16 flex justify-center gap-4 opacity-30">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </div>
      </div>

      {/* Styles */}
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
        @keyframes scale-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        .animate-scale-in {
          animation: scale-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}

