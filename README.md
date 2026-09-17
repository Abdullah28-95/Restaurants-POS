# Futec Restaurant POS — Next.js

نسخة Next.js من تطبيق المطاعم Flutter، مع نفس Futec API.

## طريقة الاتصال بالـ API

هذه النسخة تستخدم اتصالاً مباشراً من المتصفح إلى:

`https://rest-test.futec-soft.com/`

ولا تستخدم Next.js كـ proxy للـ API. السبب أن Swagger يعمل من المتصفح بينما الاتصال Server-side من Node كان يصل إلى IIS/Plesk بمسار مختلف.

- Login: المتصفح يطلب `Profile/v1.0/AppLogin` مباشرة.
- بعد نجاح الدخول، الـ JWT محفوظ داخل `sessionStorage` ويُرسل كـ `Authorization: Bearer ...` لباقي الطلبات.
- Next.js يحتفظ فقط بـ HttpOnly session cookie محلية لحماية صفحات الـ POS من الدخول بدون جلسة.
- عند إغلاق المتصفح تنتهي جلسة الـ token المحلية.

## التشغيل

```bash
npm install
npm run dev
```

ثم افتح:

`http://localhost:3000`

## إعدادات البيئة

```env
NEXT_PUBLIC_POS_API_BASE=https://rest-test.futec-soft.com/
PORT=3000
HOSTNAME=0.0.0.0
KDS_PORT=8080
```

## ملاحظة CORS

بما أن الطلبات تخرج الآن من المتصفح مباشرة، يجب أن يسمح Futec API بعنوان الـ POS في CORS، مثل:

- `http://localhost:3000`
- أو عنوان الجهاز على الشبكة إذا فتحت الـ POS من جهاز آخر، مثل `http://192.168.x.x:3000`

إذا كان CORS غير مسموح، ستظهر رسالة واضحة في شاشة الدخول، وسيظهر تفصيل الخطأ في Browser DevTools Console.

## KDS

WebSocket الافتراضي على المنفذ `8080`، والـ POS على `3000`.

## Cash / Day workflow (مطابق لتطبيق Flutter القديم)

بعد تسجيل الدخول يتم فحص التشغيل بهذا الترتيب:

1. `GET RestaurantSalesDay/v1.0/AppGetByWarehouse?Warehouse=...` لجلب يوم العمل.
2. `GET Profile/v1.0/GetSettings?Warehouse=...` لجلب وقت الإغلاق.
3. `GET RestaurantSales/v1.0/AppGetByUser?CashUser=...` للتحقق من نقطة المستخدم.
4. إذا لا توجد نقطة مفتوحة يتم توجيه المستخدم إلى شاشة فتح الكاش واستدعاء:
   `POST RestaurantSales/v1.0/OpenPointByParameters`.
5. إذا تجاوز وقت إغلاق اليوم يتم توجيه المستخدم إلى شاشة النقاط المفتوحة.

إغلاق الكاش يستخدم:
- `GET RestaurantSales/v1.0/AppGetPaymentsByCashNo`
- `GET RestaurantSales/v1.0/GetSalesSummary`
- `GET RestaurantSales/v1.0/AppGetXInfoByCashNo`
- `POST RestaurantSales/v1.0/ClosePoint`

إغلاق اليوم يستخدم:
- `GET RestaurantSales/v1.0/AppGetByDate`
- إغلاق كل نقطة عبر `POST RestaurantSales/v1.0/ClosePoint`
- وبعد عدم بقاء أي نقطة مفتوحة: `POST RestaurantSalesDay/v1.0/EndDay`
- ثم تقارير الإغلاق من `AppGetZByLineDate` و `AppGetSummaryByLineDate`.
