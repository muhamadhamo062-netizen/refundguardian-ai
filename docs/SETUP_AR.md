# RefundGuardian — إعداد سريع (عربي)

## لماذا تظهر الرسائل؟

| الرسالة | السبب الجذري |
|--------|----------------|
| **Orders table missing** | جدول `public.orders` غير موجود في Supabase — لم تُنفَّذ الـ migrations أو ملف `quick_fix_orders.sql`. |
| **Extension not detected** | الإضافة غير محمّلة، أو الصفحة ليست على `localhost:3000`، أو لم يتم **Reload** للإضافة بعد التحديث. |
| **No opportunities / No orders** | لا بيانات بعد: إما DB فارغ، أو لم تزر صفحات طلبات Amazon مع الإضافة، أو لم تسجّل الدخول. |

## خطوات الحل (بالترتيب)

1. **قاعدة البيانات**  
   في Supabase → SQL → الصق محتوى `supabase/quick_fix_orders.sql` → Run.  
   ثم افتح في المتصفح: `http://localhost:3000/api/health`  
   يجب أن ترى: `"db": "connected"` و `"ok": true`.

2. **الإضافة**  
   - Chrome → `chrome://extensions` → **Developer mode** → **Load unpacked** → مجلد `extension`.  
   - تأكد أن الموقع في القائمة يشمل `http://localhost:3000/*`.  
   - بعد أي تعديل على الملفات: زر **Reload** على الإضافة.

3. **اللوحة**  
   افتح `http://localhost:3000/dashboard` (نفس المنفذ 3000).  
   سجّل الدخول إذا طُلب منك.

4. **Amazon**  
   افتح سجل الطلبات على Amazon مع تفعيل الإضافة حتى تُملأ `chrome.storage.local` ويُرسل للـ API.

## ما تم في الكود (ملخص)

- جسر قراءة التخزين يُسجَّل **قبل** أي `return` عند حقن السكربت مرتين.  
- دعم `https://localhost:3000` في `manifest.json`.  
- اللوحة تخفي تحذير "الإضافة غير مكتشفة" عندما المشكلة الأساسية هي **جدول orders مفقود** (رسالة واحدة واضحة).  
- مهلة أطول وإعادة محاولة لطلب `postMessage` من اللوحة.
