# 🎟️ QR Event Entry System — Complete Flow Diagram

## 🏗️ System Architecture Overview

```mermaid
graph TB
    subgraph CLIENTS["👥 Clients"]
        A["🖥️ Admin\n(React Frontend)"]
        V["📱 Volunteer\n(Mobile Browser)"]
        P["📷 Public Attendee\n(Phone Camera)"]
    end

    subgraph SERVER["⚙️ Express.js Backend (index.js)"]
        MW["🔧 Middleware\nCORS · JSON Parser"]
        RL1["🛡️ Scan Rate Limiter\n60 req/min per IP"]
        RL2["🛡️ OTP Rate Limiter\n10 req/min per IP"]
        
        subgraph ROUTES["📡 Routes"]
            R1["/api/auth"]
            R2["/api/attendees"]
            R3["/api/otp"]
            R4["/verify/:token\n(Public Endpoint)"]
        end
    end

    subgraph DB["🍃 MongoDB"]
        M1["👤 User\n(Admin/Volunteer accounts)"]
        M2["🎫 Attendee\n(name · roll · token · status · OTP)"]
        M3["📋 ScanLog\n(Audit Trail)"]
    end

    A --> MW
    V --> MW
    P --> R4
    MW --> RL1
    MW --> RL2
    MW --> ROUTES
    ROUTES --> DB
```

---

## 1️⃣ Authentication Flow

```mermaid
flowchart TD
    Start(["🔐 User Opens App"])
    --> Login["POST /api/auth/login\n{username, password}"]
    --> FindUser{"User exists\nin MongoDB?"}

    FindUser -- "❌ No" --> Err401["401 Invalid Credentials"]
    FindUser -- "✅ Yes" --> CheckPass{"bcrypt.compare\npassword?"}

    CheckPass -- "❌ Wrong" --> Err401
    CheckPass -- "✅ Match" --> SignJWT["Sign JWT Token\n(30 days expiry)\nwith {id, role}"]
    --> Return["✅ 200: {token, role, username}"]

    Return --> Store["💾 Store JWT in\nlocalStorage / state"]
    --> UseApp["🎉 Access App by Role"]

    UseApp --> AdminView["Admin View\n(Upload Excel, Monitor)"]
    UseApp --> VolView["Volunteer View\n(QR Scanner)"]

    style Err401 fill:#ef4444,color:#fff
    style Return fill:#22c55e,color:#fff
```

---

## 2️⃣ Admin — Excel Upload & QR Generation Flow

```mermaid
flowchart TD
    A(["👨‍💼 Admin Logged In"])
    --> Upload["📤 Upload Excel File\nPOST /api/attendees/upload-excel\n+ JWT Token + Field Mapping"]

    Upload --> AuthMW{"🔒 Auth Middleware\nJWT Valid?"}
    AuthMW -- "❌ Invalid" --> Err401["401 Unauthorized"]
    AuthMW -- "✅ Valid" --> RoleCheck{"Role = Admin?"}
    RoleCheck -- "❌ No" --> Err403["403 Forbidden"]
    RoleCheck -- "✅ Yes" --> Multer["📥 multer parses file\n(memory storage)"]

    Multer --> ParseExcel["📊 xlsx.read buffer\nExtract rows from Sheet1"]
    --> ValidateMapping["Validate Field Mapping\nname + roll required"]
    --> LoopRows["🔄 Loop through each row"]

    LoopRows --> CheckEmpty{"name/roll\nempty?"}
    CheckEmpty -- "✅ Yes" --> MarkError["Mark: Error - Missing fields"]
    CheckEmpty -- "❌ No" --> CollectRolls["Collect all valid rolls"]

    CollectRolls --> BulkCheck["🔍 Attendee.find\nAll existing rolls in DB\n(one query)"]

    BulkCheck --> ForEachRow["For each valid row"]
    ForEachRow --> InDB{"Roll exists\nin DB?"}
    InDB -- "✅ Yes" --> SkipDB["Mark: Skipped - Duplicate in DB"]
    InDB -- "❌ No" --> InFile{"Roll seen in\nthis file already?"}
    InFile -- "✅ Yes" --> SkipFile["Mark: Skipped - Duplicate in File"]
    InFile -- "❌ No" --> GenToken["Generate UUID token\nBuild QR Link:\n/verify/{token}"]

    GenToken --> SaveAttendee["💾 Add to newAttendees array\n{name, roll, email, token, qrLink}"]
    SaveAttendee --> MarkAdded["Mark: Added ✅"]

    MarkAdded --> BulkInsert["Attendee.insertMany\n(ordered: false)"]
    --> GenQRImages["🖼️ QRCode.toBuffer\nfor each new attendee\n(PNG 300x300)"]
    --> BuildZIP["📦 archiver creates ZIP:\n- processed_attendees.xlsx\n- qrs/{roll}.png (per attendee)"]
    --> SendZIP["⬇️ ZIP sent as download"]

    style Err401 fill:#ef4444,color:#fff
    style Err403 fill:#ef4444,color:#fff
    style MarkAdded fill:#22c55e,color:#fff
    style SendZIP fill:#3b82f6,color:#fff
```

---

## 3️⃣ Volunteer — QR Scan Flow

```mermaid
flowchart TD
    V(["📱 Volunteer Opens Scanner\n(jsQR camera feed)"])
    --> Scan["📷 Camera detects QR Code\nDecodes token from image"]
    --> ScanReq["POST /api/attendees/scan\n{token} + JWT Header"]

    ScanReq --> ScanRL{"🛡️ Rate Limiter\n< 60 req/min?"}
    ScanRL -- "❌ Over limit" --> RL429["429 Too Many Requests"]
    ScanRL -- "✅ OK" --> AuthMW{"🔒 JWT Valid?"}
    AuthMW -- "❌ No" --> Err401["401 Unauthorized"]
    AuthMW -- "✅ Yes" --> RoleCheck{"Role = Admin\nor Volunteer?"}
    RoleCheck -- "❌ No" --> Err403["403 Forbidden"]
    RoleCheck -- "✅ Yes" --> FindToken["Attendee.findOne\n{token}"]

    FindToken --> Exists{"Attendee\nfound?"}
    Exists -- "❌ No" --> LogInvalid["📋 ScanLog: INVALID_TOKEN"]
    --> Err404["404 Invalid QR Token"]

    Exists -- "✅ Yes" --> CheckMethod{"entry_method?"}

    CheckMethod -- "OTP (already verified)" --> LogOTP["📋 ScanLog: ALREADY_USED_OTP\n(success: true)"]
    --> OTPSuccess["✅ 200: Already verified via OTP\nShown as GREEN on UI"]

    CheckMethod -- "QR (already scanned)" --> LogQRDup["📋 ScanLog: ALREADY_USED_QR\n(success: false)"]
    --> QRErr["❌ 400: Already scanned via QR"]

    CheckMethod -- "UNUSED" --> AtomicUpdate["Attendee.findOneAndUpdate\n{_id, status:'UNUSED'}\n→ status:'USED', entry_method:'QR'\ncheckedInAt: now()"]

    AtomicUpdate --> Updated{"Update\nsucceeded?"}
    Updated -- "❌ Race Condition" --> LogRace["📋 ScanLog: ALREADY_USED_QR"]
    --> RaceErr["❌ 400: Scanned by another device"]

    Updated -- "✅ Yes" --> LogSuccess["📋 ScanLog: ALLOWED\n(success: true)"]
    --> AllowEntry["✅ 200: Entry Allowed!\n{name, roll, checkedInAt}"]
    --> GreenUI["📱 Volunteer sees\n✅ GREEN Screen"]

    style RL429 fill:#f97316,color:#fff
    style Err401 fill:#ef4444,color:#fff
    style Err403 fill:#ef4444,color:#fff
    style Err404 fill:#ef4444,color:#fff
    style QRErr fill:#ef4444,color:#fff
    style RaceErr fill:#ef4444,color:#fff
    style AllowEntry fill:#22c55e,color:#fff
    style OTPSuccess fill:#22c55e,color:#fff
    style GreenUI fill:#22c55e,color:#fff
```

---

## 4️⃣ OTP Manual Entry Flow (Fallback)

```mermaid
flowchart TD
    V(["📱 Volunteer / Admin\n(Manual Entry)"])
    --> EnterRoll["Enter Roll Number\nPOST /api/otp/send\n{roll} + JWT"]

    EnterRoll --> OTPRateLimit{"🛡️ OTP Rate Limiter\n< 10 req/min?"}
    OTPRateLimit -- "❌ Over limit" --> RL429["429 Too Many Requests"]
    OTPRateLimit -- "✅ OK" --> FindAttendee["Attendee.findOne({roll})"]

    FindAttendee --> Found{"Found?"}
    Found -- "❌ No" --> Err404["404 Attendee not found"]
    Found -- "✅ Yes" --> AlreadyUsed{"Status = USED?"}
    AlreadyUsed -- "✅ Yes" --> Err400Used["400 Already checked in"]

    AlreadyUsed -- "❌ No" --> Check30s{"Last OTP sent\n< 30 seconds ago?"}
    Check30s -- "✅ Yes" --> Err429Cooldown["429 Wait 30 seconds"]

    Check30s -- "❌ No" --> CheckAttempts{"OTP attempts\n≥ 3?"}
    CheckAttempts -- "✅ Yes" --> Err403Max["403 Max attempts exceeded"]

    CheckAttempts -- "❌ No" --> GenOTP["Generate 6-digit OTP\nExpiry: now + 2 minutes\nIncrement attempts"]
    --> SaveOTP["💾 attendee.save()\n{code, expiry, attempts, lastSentTime}"]
    --> SendEmail{"📧 SMTP configured\n& email exists?"}

    SendEmail -- "✅ Yes" --> Email["nodemailer.sendMail\nSubject: Your Event Entry OTP"]
    SendEmail -- "❌ No" --> Console["console.log OTP\n(Dev mode)"]

    Email --> OTPSent["✅ 200: OTP Sent"]
    Console --> OTPSent

    OTPSent --> EnterOTP["Volunteer enters OTP\nPOST /api/otp/verify\n{roll, otp} + JWT"]

    EnterOTP --> FindAgain["Attendee.findOne({roll})"]
    --> ValidateOTP{"OTP Checks"}

    ValidateOTP -- "Expired\n(now > expiry)" --> ErrExpired["❌ 400: OTP Expired"]
    ValidateOTP -- "Wrong code" --> IncrAttempt["Increment attempts\n💾 save()"]
    --> ErrWrong["❌ 400: Invalid OTP"]

    ValidateOTP -- "✅ Correct" --> AtomicOTP["Attendee.findOneAndUpdate\n{_id, status:'UNUSED'}\n→ status:'USED', entry_method:'OTP'\n$unset: otp"]

    AtomicOTP --> OTPUpdated{"Update\nsucceeded?"}
    OTPUpdated -- "❌ Race Condition" --> ErrRace["❌ 400: Already checked in"]
    OTPUpdated -- "✅ Yes" --> OTPAllowed["✅ 200: ALLOWED\n{name}"]

    style RL429 fill:#f97316,color:#fff
    style Err404 fill:#ef4444,color:#fff
    style Err400Used fill:#ef4444,color:#fff
    style Err429Cooldown fill:#f97316,color:#fff
    style Err403Max fill:#ef4444,color:#fff
    style ErrExpired fill:#ef4444,color:#fff
    style ErrWrong fill:#ef4444,color:#fff
    style ErrRace fill:#ef4444,color:#fff
    style OTPAllowed fill:#22c55e,color:#fff
    style OTPSent fill:#3b82f6,color:#fff
```

---

## 5️⃣ Public Self-Scan Flow (Phone Camera → Browser)

```mermaid
flowchart TD
    P(["📷 Attendee scans QR\nwith phone camera"])
    --> Browser["Browser opens:\nGET /verify/{token}"]

    Browser --> FindToken["Attendee.findOneAndUpdate\n{token, status:'UNUSED'}\n→ status:'USED', entry_method:'QR'\n(atomic)"]

    FindToken --> Updated{"Updated?"}

    Updated -- "❌ No update" --> CheckExists["Attendee.findOne({token})"]
    CheckExists --> TokenExists{"Token\nexists?"}
    TokenExists -- "❌ No" --> HTML404["🔴 HTML: ❌ Invalid QR Code\nThis token does not exist"]
    TokenExists -- "✅ Yes (already used)" --> HTML400["🟡 HTML: ⚠️ Already Scanned!\nName + Roll shown"]

    Updated -- "✅ Yes" --> HTML200["🟢 HTML: ✅ Entry Allowed!\nName + Roll + 'Checked in securely'"]

    style HTML404 fill:#ef4444,color:#fff
    style HTML400 fill:#f97316,color:#fff
    style HTML200 fill:#22c55e,color:#fff
```

---

## 🗄️ Database Models Summary

```mermaid
erDiagram
    USER {
        ObjectId _id
        String username "unique"
        String password "bcrypt hashed"
        String role "Admin or Volunteer"
    }

    ATTENDEE {
        ObjectId _id
        String name
        String roll "unique"
        String email
        String token "unique UUID"
        String qrLink
        String status "UNUSED or USED"
        String entry_method "QR or OTP"
        Date checkedInAt
        Object otp "code · expiry · attempts · lastSentTime"
    }

    SCANLOG {
        ObjectId _id
        String token "indexed"
        ObjectId attendeeId
        String attendeeName
        String attendeeRoll
        Boolean success
        String resultCode "ALLOWED · ALREADY_USED_QR · ALREADY_USED_OTP · INVALID_TOKEN"
        String ip
        String userAgent
        Date timestamp
    }

    ATTENDEE ||--o{ SCANLOG : "generates"
```

---

## 🛡️ Security Layer Summary

| Layer | Mechanism | Limit |
|-------|-----------|-------|
| **Authentication** | JWT (30-day expiry) | All protected routes |
| **Authorization** | Role-based (Admin / Volunteer) | Per-route `authorize()` |
| **Scan Rate Limit** | express-rate-limit per IP | 60 req/min |
| **OTP Rate Limit** | express-rate-limit per IP | 10 req/min |
| **OTP Cooldown** | 30s between resends | Per attendee |
| **OTP Max Attempts** | Hard block after 3 tries | Per attendee |
| **Double Scan Prevention** | MongoDB atomic `findOneAndUpdate` | Race condition safe |
| **Audit Trail** | ScanLog every attempt | Success + Failure |

---

## 🔄 Entry Method Decision Tree

```mermaid
flowchart LR
    Start(["Attendee arrives at gate"])
    --> HasQR{"Has QR code\non phone/print?"}

    HasQR -- "✅ Yes" --> VolScan["Volunteer scans\nwith phone camera\n(jsQR)"]
    HasQR -- "✅ Self" --> SelfScan["Attendee opens\ncamera app\nscans own QR"]
    HasQR -- "❌ No QR" --> OTPPath["Volunteer enters\nRoll Number\n→ OTP via Email"]

    VolScan --> QRResult{"QR Scan\nResult"}
    SelfScan --> PublicResult{"Public Endpoint\nResult"}
    OTPPath --> OTPResult{"OTP\nVerified?"}

    QRResult -- "✅ ALLOWED" --> EntryGranted(["✅ Entry Granted"])
    QRResult -- "✅ ALREADY_USED_OTP" --> EntryGranted
    QRResult -- "❌ ALREADY_USED_QR" --> EntryDenied(["❌ Entry Denied"])
    QRResult -- "❌ INVALID_TOKEN" --> EntryDenied

    PublicResult -- "✅ Updated" --> EntryGranted
    PublicResult -- "❌ Already used / Invalid" --> EntryDenied

    OTPResult -- "✅ Yes" --> EntryGranted
    OTPResult -- "❌ No" --> EntryDenied

    style EntryGranted fill:#22c55e,color:#fff
    style EntryDenied fill:#ef4444,color:#fff
```
