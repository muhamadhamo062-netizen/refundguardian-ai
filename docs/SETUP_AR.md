# Refyndra — إعداد سريع (عربي)

## لماذا تظهر الرسائل؟

| الرسالة | السبب الجذري |
|--------|----------------|
| **Orders table missing** | جدول `public.orders` غير موجود في Supabase — لم تُنفَّذ الـ migrations أو ملف `quick_fix_orders.sql`. |
| **Gmail / IMAP not connected** | لم تُدخل بيانات Gmail (App Password) في لوحة التحكم، أو المفتاح `GMAIL_IMAP_ENCRYPTION_KEY` غير مضبوط على الخادم. |
| **No opportunities / No orders** | لا بيانات بعد: إما DB فارغ، أو لم يكتمل مسح البريد بعد الربط، أو لم تسجّل الدخول. |

## خطوات الحل (بالترتيب)

1. **قاعدة البيانات**  
   في Supabase → SQL → الصق محتوى `supabase/quick_fix_orders.sql` → Run.  
   ثم افتح في المتصفح: `http://localhost:3000/api/health`  
   يجب أن ترى: `"db": "connected"` و `"ok": true`.

2. **ربط Gmail (IMAP)**  
   افتح `http://localhost:3000/dashboard` واتبع قسم **Gmail / IMAP** لإدخال البريد وكلمة مرور التطبيق (App Password).  
   تأكد من ضبط `GMAIL_IMAP_ENCRYPTION_KEY` في `.env` (انظر `.env.local.example`).

3. **اللوحة**  
   سجّل الدخول إذا طُلب منك. بعد الربط، انتظر اكتمال المسح أو شغّل جدولة `imap-scan` إن كنت تستخدمها.

## ملاحظة

لا يوجد مسار متصفح أو إضافة Chrome لجلب الطلبات — المصدر الوحيد المعتمد هو صندوق Gmail عبر IMAP من لوحة التحكم.
