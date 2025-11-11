'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import FormInput from '@/lib/components/FormInput';
import Button from '@/lib/components/Button';
import { Mail, Lock, Shield } from 'lucide-react';

export default function SuperAdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
          role: 'SUPER_ADMIN',
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
        window.location.href = '/super-admin/dashboard';
      }, 500);
    } catch (error) {
      console.error('Login error:', error);
      toast.error('حدث خطأ أثناء تسجيل الدخول');
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex">
      {/* Left Side - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-primary relative overflow-hidden">
        {/* Decorative Shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full -ml-48 -mb-48 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-2xl" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
          <div className="mb-8">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 shadow-large">
              <Shield className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-bold mb-4">لوحة تحكم المشرف</h1>
            <p className="text-xl text-white/90">
              إدارة شاملة للنظام والتحكم الكامل في جميع العمليات
            </p>
          </div>
          
          {/* Features */}
          <div className="space-y-4 mt-8">
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-2 h-2 bg-white rounded-full" />
              <span>إدارة الحسابات والخطط</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-2 h-2 bg-white rounded-full" />
              <span>مراقبة الاشتراكات والعملاء</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-2 h-2 bg-white rounded-full" />
              <span>تقارير وإحصائيات مفصلة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-2xl mb-4 shadow-medium">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">لوحة تحكم المشرف</h1>
            <p className="text-gray-600">تسجيل الدخول كمسؤول رئيسي</p>
          </div>

          {/* Desktop Title */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">تسجيل الدخول</h2>
            <p className="text-gray-600">أدخل بياناتك للوصول إلى لوحة التحكم</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <FormInput
              label="البريد الإلكتروني"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
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
              className="w-full"
            >
              تسجيل الدخول
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              نظام إدارة متكامل للاجتماعات المرئية
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
