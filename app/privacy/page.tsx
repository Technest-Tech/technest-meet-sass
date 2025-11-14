import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Academiq-meet',
  description: 'Privacy Policy for Academiq-meet video conferencing platform',
};

export default function PrivacyPolicyPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 lg:p-12">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
            <span>العودة للصفحة الرئيسية</span>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">سياسة الخصوصية</h1>
          <p className="text-gray-600">آخر تحديث: {new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. مقدمة</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              نرحب بك في <strong>Academiq-meet</strong>. نحن ملتزمون بحماية خصوصيتك وضمان أمان بياناتك. 
              توضح سياسة الخصوصية هذه كيفية جمع واستخدام وحماية المعلومات الشخصية عند استخدام منصة 
              Academiq-meet للاجتماعات والمحاضرات الافتراضية.
            </p>
            <p className="text-gray-700 leading-relaxed">
              باستخدامك لخدماتنا، فإنك توافق على ممارسات جمع واستخدام المعلومات الموضحة في هذه السياسة.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. المعلومات التي نجمعها</h2>
            
            <h3 className="text-xl font-semibold text-gray-800 mb-3">2.1 المعلومات التي تقدمها لنا</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li><strong>معلومات الحساب:</strong> الاسم، عنوان البريد الإلكتروني، كلمة المرور</li>
              <li><strong>معلومات الملف الشخصي:</strong> الصورة الشخصية (اختياري)، معلومات الاتصال</li>
              <li><strong>معلومات الاجتماعات:</strong> اسم الغرفة، إعدادات الاجتماع، الملفات المشتركة</li>
              <li><strong>معلومات الدفع:</strong> معلومات الاشتراك والخطة (يتم معالجتها بشكل آمن)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.2 المعلومات التي نجمعها تلقائياً</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li><strong>معلومات الجهاز:</strong> نوع الجهاز، نظام التشغيل، إصدار المتصفح</li>
              <li><strong>معلومات الاتصال:</strong> عنوان IP، معلومات الشبكة، جودة الاتصال</li>
              <li><strong>معلومات الاستخدام:</strong> مدة الاجتماعات، عدد المشاركين، الميزات المستخدمة</li>
              <li><strong>ملفات تعريف الارتباط:</strong> نستخدم ملفات تعريف الارتباط لتحسين تجربتك</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">2.3 محتوى الاجتماعات</h3>
            <p className="text-gray-700 leading-relaxed">
              <strong>ملاحظة مهمة:</strong> نحن لا نسجل أو نخزن محتوى الاجتماعات (الفيديو والصوت) إلا إذا قمت 
              بتفعيل ميزة التسجيل صراحة. في حالة التسجيل، يتم تخزين التسجيلات بشكل آمن ويمكنك الوصول إليها 
              أو حذفها في أي وقت.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. كيفية استخدام المعلومات</h2>
            <p className="text-gray-700 leading-relaxed mb-4">نستخدم المعلومات التي نجمعها للأغراض التالية:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li>توفير وتحسين خدمات الفيديو والاجتماعات الافتراضية</li>
              <li>إدارة حسابك والاشتراكات</li>
              <li>تسهيل التواصل بين المشاركين في الاجتماعات</li>
              <li>ضمان أمان النظام ومنع الاحتيال</li>
              <li>تقديم الدعم الفني والرد على استفساراتك</li>
              <li>إرسال إشعارات مهمة حول الخدمة</li>
              <li>تحليل استخدام الخدمة لتحسين الأداء</li>
              <li>الامتثال للالتزامات القانونية</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. مشاركة المعلومات</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              نحن لا نبيع معلوماتك الشخصية. قد نشارك معلوماتك فقط في الحالات التالية:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li><strong>مزودو الخدمات:</strong> نستخدم LiveKit لتوفير خدمات الفيديو. راجع سياسة خصوصية LiveKit</li>
              <li><strong>الامتثال القانوني:</strong> عند الحاجة للامتثال للقوانين أو الاستجابة لطلبات قانونية</li>
              <li><strong>حماية الحقوق:</strong> لحماية حقوقنا ومستخدمينا من الاحتيال أو إساءة الاستخدام</li>
              <li><strong>الموافقة:</strong> عند موافقتك الصريحة على المشاركة</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. أمان البيانات</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              نطبق إجراءات أمنية متعددة لحماية معلوماتك:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li><strong>التشفير:</strong> نستخدم تشفير SSL/TLS لجميع الاتصالات</li>
              <li><strong>تشفير من طرف إلى طرف (E2EE):</strong> متاح كخيار إضافي للاجتماعات الحساسة</li>
              <li><strong>حماية كلمات المرور:</strong> يتم تشفير كلمات المرور باستخدام bcrypt</li>
              <li><strong>الوصول المحدود:</strong> فقط الموظفون المصرح لهم يمكنهم الوصول إلى البيانات</li>
              <li><strong>النسخ الاحتياطي:</strong> نسخ احتياطية منتظمة وآمنة للبيانات</li>
              <li><strong>التحديثات الأمنية:</strong> نحدث أنظمتنا بانتظام لمعالجة الثغرات الأمنية</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. تخزين البيانات</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              يتم تخزين بياناتك على خوادم آمنة في مواقع جغرافية محددة. نحتفظ ببياناتك طالما كان حسابك 
              نشطاً أو حسب المدة المطلوبة قانونياً. يمكنك حذف حسابك في أي وقت، وسيتم حذف بياناتك الشخصية 
              خلال 30 يوماً من الطلب.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>ملاحظة:</strong> قد نحتفظ ببعض المعلومات لأغراض قانونية أو أمنية حتى بعد حذف حسابك.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. خصوصية الأطفال</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              خدماتنا غير موجهة للأطفال دون سن 13 عاماً. لا نجمع عمداً معلومات شخصية من الأطفال دون 13 عاماً. 
              إذا علمنا أننا جمعنا معلومات من طفل دون 13 عاماً، سنقوم بحذف هذه المعلومات فوراً.
            </p>
            <p className="text-gray-700 leading-relaxed">
              إذا كنت والداً أو وصياً وترى أن طفلك قد زودنا بمعلومات شخصية، يرجى الاتصال بنا فوراً.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. حقوقك</h2>
            <p className="text-gray-700 leading-relaxed mb-4">لديك الحقوق التالية فيما يتعلق ببياناتك:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li><strong>حق الوصول:</strong> يمكنك طلب نسخة من بياناتك الشخصية</li>
              <li><strong>حق التصحيح:</strong> يمكنك تحديث أو تصحيح بياناتك في أي وقت</li>
              <li><strong>حق الحذف:</strong> يمكنك طلب حذف بياناتك الشخصية</li>
              <li><strong>حق الاعتراض:</strong> يمكنك الاعتراض على معالجة بياناتك</li>
              <li><strong>حق نقل البيانات:</strong> يمكنك طلب نقل بياناتك إلى خدمة أخرى</li>
              <li><strong>حق سحب الموافقة:</strong> يمكنك سحب موافقتك على معالجة البيانات</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              لممارسة أي من هذه الحقوق، يرجى الاتصال بنا على البريد الإلكتروني المذكور أدناه.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. ملفات تعريف الارتباط (Cookies)</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              نستخدم ملفات تعريف الارتباط لتحسين تجربتك. أنواع ملفات تعريف الارتباط التي نستخدمها:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li><strong>ملفات تعريف الارتباط الضرورية:</strong> مطلوبة لتشغيل الموقع</li>
              <li><strong>ملفات تعريف الارتباط الوظيفية:</strong> لتذكر تفضيلاتك</li>
              <li><strong>ملفات تعريف الارتباط التحليلية:</strong> لفهم كيفية استخدام الموقع</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              يمكنك إدارة ملفات تعريف الارتباط من خلال إعدادات المتصفح الخاص بك.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. التغييرات على سياسة الخصوصية</h2>
            <p className="text-gray-700 leading-relaxed">
              قد نحدث سياسة الخصوصية هذه من وقت لآخر. سنقوم بإشعارك بأي تغييرات جوهرية عبر البريد الإلكتروني 
              أو إشعار على الموقع. ننصحك بمراجعة هذه الصفحة بانتظام للاطلاع على أي تحديثات.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. الخدمات الخارجية</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              نستخدم خدمات خارجية لتوفير وظائف معينة:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li><strong>LiveKit:</strong> لتوفير خدمات الفيديو والصوت. راجع <a href="https://livekit.io/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">سياسة خصوصية LiveKit</a></li>
              <li><strong>مزودو الاستضافة:</strong> DigitalOcean لاستضافة الخوادم</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              هذه الخدمات لها سياسات خصوصية خاصة بها، وننصحك بمراجعتها.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. الاتصال بنا</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              إذا كان لديك أي أسئلة أو مخاوف بشأن سياسة الخصوصية هذه أو ممارساتنا، يرجى الاتصال بنا:
            </p>
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <p className="text-gray-700 mb-2">
                <strong>البريد الإلكتروني:</strong>{' '}
                <a href="mailto:technestagency@gmail.com" className="text-blue-600 hover:underline">
                  technestagency@gmail.com
                </a>
              </p>
              <p className="text-gray-700">
                <strong>الموقع الإلكتروني:</strong>{' '}
                <a href="https://acadmyq.com" className="text-blue-600 hover:underline">
                  https://acadmyq.com
                </a>
              </p>
            </div>
          </section>

          <section className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">الموافقة</h2>
            <p className="text-gray-700 leading-relaxed">
              باستخدامك لخدمات Academiq-meet، فإنك تقر بأنك قد قرأت وفهمت سياسة الخصوصية هذه وتوافق على 
              جمع واستخدام معلوماتك كما هو موضح هنا.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
            <span>العودة للصفحة الرئيسية</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

