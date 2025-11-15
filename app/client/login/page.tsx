'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import FormInput from '@/lib/components/FormInput';
import Button from '@/lib/components/Button';
import { Mail, Lock, Video, MessageCircle, HelpCircle, Info } from 'lucide-react';

export default function ClientLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          role: 'CLIENT',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'فشل تسجيل الدخول');
        setIsLoading(false);
        return;
      }

      toast.success('تم تسجيل الدخول بنجاح');
      setTimeout(() => {
        window.location.href = '/client/dashboard';
      }, 500);
    } catch (error) {
      console.error('Login error:', error);
      toast.error('حدث خطأ أثناء تسجيل الدخول');
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex bg-gray-50">
      {/* Left Side - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-primary relative overflow-hidden">
        {/* Decorative Shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full -ml-48 -mb-48 blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-2xl" />
        
        {/* LMS Vector Illustration */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <svg
            width="600"
            height="600"
            viewBox="0 0 600 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            {/* Graduation Cap */}
            <path
              d="M300 100L150 180L300 260L450 180L300 100Z"
              fill="white"
              opacity="0.3"
            />
            <path
              d="M150 180L300 260L450 180"
              stroke="white"
              strokeWidth="3"
              opacity="0.4"
            />
            
            {/* Book 1 */}
            <rect
              x="100"
              y="350"
              width="120"
              height="150"
              rx="8"
              fill="white"
              opacity="0.25"
            />
            <line
              x1="160"
              y1="380"
              x2="160"
              y2="480"
              stroke="white"
              strokeWidth="2"
              opacity="0.4"
            />
            <line
              x1="100"
              y1="420"
              x2="220"
              y2="420"
              stroke="white"
              strokeWidth="2"
              opacity="0.4"
            />
            
            {/* Book 2 */}
            <rect
              x="240"
              y="360"
              width="120"
              height="150"
              rx="8"
              fill="white"
              opacity="0.25"
            />
            <line
              x1="300"
              y1="390"
              x2="300"
              y2="490"
              stroke="white"
              strokeWidth="2"
              opacity="0.4"
            />
            <line
              x1="240"
              y1="430"
              x2="360"
              y2="430"
              stroke="white"
              strokeWidth="2"
              opacity="0.4"
            />
            
            {/* Book 3 */}
            <rect
              x="380"
              y="350"
              width="120"
              height="150"
              rx="8"
              fill="white"
              opacity="0.25"
            />
            <line
              x1="440"
              y1="380"
              x2="440"
              y2="480"
              stroke="white"
              strokeWidth="2"
              opacity="0.4"
            />
            <line
              x1="380"
              y1="420"
              x2="500"
              y2="420"
              stroke="white"
              strokeWidth="2"
              opacity="0.4"
            />
            
            {/* Learning Path Lines */}
            <path
              d="M200 280 Q250 300 300 320 T400 340"
              stroke="white"
              strokeWidth="2"
              fill="none"
              opacity="0.3"
              strokeDasharray="5,5"
            />
            
            {/* Certificate */}
            <rect
              x="220"
              y="200"
              width="160"
              height="120"
              rx="4"
              fill="white"
              opacity="0.2"
            />
            <circle
              cx="300"
              cy="240"
              r="20"
              fill="white"
              opacity="0.3"
            />
            <line
              x1="240"
              y1="280"
              x2="360"
              y2="280"
              stroke="white"
              strokeWidth="2"
              opacity="0.4"
            />
            
            {/* Stars/Sparkles */}
            <circle cx="120" cy="250" r="3" fill="white" opacity="0.5" />
            <circle cx="480" cy="280" r="3" fill="white" opacity="0.5" />
            <circle cx="150" cy="320" r="2" fill="white" opacity="0.5" />
            <circle cx="450" cy="310" r="2" fill="white" opacity="0.5" />
          </svg>
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
          <div className="mb-8 text-center">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-6 shadow-2xl mx-auto transform hover:scale-105 transition-transform duration-300">
              <Video className="w-12 h-12" />
            </div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              لوحة تحكم العميل
            </h1>
            <p className="text-xl text-white/90 max-w-md">
              إدارة غرفك واجتماعاتك بسهولة وأمان مع أحدث التقنيات
            </p>
          </div>
          
          {/* Features */}
          <div className="space-y-5 mt-12 max-w-md">
            <div className="flex items-center gap-4 text-white/95 bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <span className="text-lg font-medium">إنشاء وإدارة الغرف</span>
            </div>
            <div className="flex items-center gap-4 text-white/95 bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <span className="text-lg font-medium">متابعة الاشتراك والاستخدام</span>
            </div>
            <div className="flex items-center gap-4 text-white/95 bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <span className="text-lg font-medium">إحصائيات وتقارير مفصلة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-primary rounded-3xl mb-4 shadow-xl">
              <Video className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">تسجيل الدخول</h1>
            <p className="text-gray-600">لوحة تحكم العميل</p>
          </div>

          {/* Desktop Title */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">تسجيل الدخول</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
            <FormInput
              label="البريد الإلكتروني"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="client@example.com"
              leftIcon={<Mail className="w-5 h-5" />}
            />

            <FormInput
              label="كلمة المرور"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              leftIcon={<Lock className="w-5 h-5" />}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-8"
            >
              تسجيل الدخول
            </Button>
          </form>

          {/* Support Contact Section */}
          <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">تحتاج إلى حساب؟</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              تواصل معنا للحصول على حساب جديد أو استعادة بيانات الدخول
            </p>
            
            <div className="space-y-3">
              {/* Email Contact */}
              <a
                href="mailto:technestagency@gmail.com"
                className="flex items-center gap-3 p-3 bg-white rounded-xl hover:bg-gray-50 transition-colors border border-gray-200 group"
              >
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                  <Mail className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">البريد الإلكتروني</p>
                  <p className="text-sm font-medium text-gray-900">technestagency@gmail.com</p>
                </div>
              </a>

              {/* WhatsApp Contact */}
              <a
                href="https://wa.me/201557601371"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white rounded-xl hover:bg-gray-50 transition-colors border border-gray-200 group"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">واتساب</p>
                  <p className="text-sm font-medium text-gray-900">01557601371</p>
                </div>
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              نظام اجتماعات مرئية متقدم ومتطور
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
