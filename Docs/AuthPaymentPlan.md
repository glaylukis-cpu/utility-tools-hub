# Auth & Payment Plan

> **Status: Design Documentation Only**  
> This document outlines the planned account authentication and payment state management for Utility Tools Hub.  
> No implementation exists at this time.

---

## 1. Overview

- Account authentication and payment state management designed for future integration into Utility Tools Hub.
- At present, this is a design memo only — no code is implemented.
- The desktop app will **not** handle card information directly. All payments are assumed to be processed via external browser-based checkout flows.

---

## 2. Plan States

| State | Description |
|---|---|
| `unknown` | Initial state. Payment status has not yet been determined. |
| `free` | No active subscription or purchase. Free-tier features only. |
| `signed_in_free` | User is authenticated but has not made a payment. Free-tier features apply. |
| `paid` | Active subscription or purchase confirmed. Pro features unlocked. |
| `expired` | Subscription has expired. Falls back to free tier. |
| `offline_grace` | Server unreachable, but previous paid confirmation exists within grace period. Pro features temporarily available. |
| `error` | Unable to determine payment status due to an error. |

### Per-State Details

#### `unknown`
- **意味**: アプリ起動直後など、決済状態がまだ取得できていない初期状態
- **UI表示**: 何のラベルも表示しない（または "checking..." インジケーター）
- **使用可能機能**: Free 機能のみ
- **注意点**: サーバー接続後に適切な状態に遷移するまでFree扱いでロックしておく

#### `free`
- **意味**: アカウント未登録・未決済の確認済み状態
- **UI表示**: "Free" ラベルを常時表示
- **使用可能機能**: Free 機能のみ
- **注意点**: Pro機能をクリックすると Upgrade ダイアログが出現する

#### `signed_in_free`
- **意味**: ログインは完了しているが、まだ決済していない状態
- **UI表示**: "Free" ラベル。プロフィール名などアカウント情報は表示可
- **使用可能機能**: Free 機能のみ（freeと同じ制限）
- **注意点**: ユーザーがログインしたからといってProにはならない。Checkout導線を提示する

#### `paid`
- **意味**: 有効なサブスクリプションまたは購入が確認済み
- **UI表示**: "Pro active" ラベルを常時表示
- **使用可能機能**: 全機能（Free + Pro）
- **注意点**:定期的にサーバー側での再確認を行う。常時信頼せず、ステータスの変更を検知する

#### `expired`
- **意味**: サブスクリプションの有効期限が切れている状態
- **UI表示**: "Expired" ラベル。renewal を促すCTAを表示
- **使用可能機能**: Free 機能のみ（paidと同様に制限を戻す）
- **注意点**: 猶予期間の設定可否は将来的に検討。現時点では直ちにFreeに戻る

#### `offline_grace`
- **意味**: サーバーに接続できないが、以前の確認でpaidであったことがローカルに記録されており、猶予期間内である状態
- **UI表示**: "Offline grace" ラベル。Pro機能は一時的に使用可能だが、ステータスに注意喚起を表示
- **使用可能機能**: Pro 機能を一時許可
- **注意点**: 猶予期限（例:3〜7日）切れ時はFreeに戻す。サーバー接続恢復次第即座に再確認し、適切な状態に遷移する

#### `error`
- **意味**: サーバーエラーなどにより決済状態の判定が不可能な状態
- **UI表示**: "Unable to verify status" など、過度に怖い表現を避け、簡潔なメッセージを表示
- **使用可能機能**: Free 機能のみ（安全側へ振る）
- **注意点**: リトライボタンまたは後で再確認する旨を表示。Freeロックはユーザー体験を損なわないように調整

---

## 3. Account States

| State | Description |
|---|---|
| `not_signed_in` | User has not initiated a sign-in flow. |
| `signing_in` | Sign-in is in progress (e.g., waiting for external browser redirect). |
| `signed_in` | User is logged in with valid authentication. |
| `signed_out` | User was signed in and explicitly signed out. |
| `auth_error` | Authentication failed or encountered an error. |

### Details

- **未ログインでも基本機能は使える**: `not_signed_in` 状態でアプリの起動・Free機能の操作が可能。アカウントが義務付けられるのはPro機能使用時以降を想定する。
- **ログイン済みでも未決済ならFree扱い**: `signed_in` 状態かつ payment が未取得の場合は `signed_in_free` としてFree制限を適用する。
- **認証は将来的に外部ブラウザ/サーバー連携を想定**: アプリ内部で認証情報を保持しない。OAuthまたはブラウザリダイレクト経由でサインインフローを実現する。

---

## 4. Payment States

| State | Description |
|---|---|
| `no_payment` | No payment has ever been initiated. |
| `checkout_pending` | User started a checkout flow; awaiting confirmation from the payment provider. |
| `paid_active` | Payment confirmed and active by the server. |
| `payment_failed` | Payment was attempted but failed (declined card, insufficient funds, etc.). |
| `subscription_expired` | Subscription period has ended and not renewed. |
| `refunded_or_revoked` | Payment was refunded or access was revoked by admin/provider. |

### Details

- **決済完了判定はローカルだけで信用しない**: ローカルの保存データはキャッシュとしてのみ使用。真の決済状態は常にサーバー側APIで確認する。
- **サーバー側確認を正とする**: サーバーが `paid_active` を返してきたときのみPro機能をアンロックする。
- **ローカル保存は表示キャッシュとオフライン猶予用に限定**: 前回確認済みのpaidステータスとタイムスタンプだけを保存し、オフライン時の grace period の判定に使用する。

---

## 5. Offline Behavior

| Rule | Description |
|---|---|
| Grace eligibility | Only if the last known server-confirmed status was `paid`. |
| Grace duration | Example: 3 to 7 days after the server becomes unreachable. |
| Grace expiry | After grace period expires, fall back to Free tier behavior. |
| First launch offline | Do **not** assume paid status on first launch when completely offline. |

### Details

- **前回paid確認済みの場合のみ `offline_grace` を許可**: ローカルにタイムスタンプ付きの "server confirmed paid" 記録が存在する場合のみ。ローカル書き込みだけで判定しない。
- **猶予期間例: 3日〜7日**: まだ確定値ではない。将来の設定項目として検討する。
- **猶予期限切れ時はFree扱いに戻す**: grace period が切れた時点でPro機能を無効化し、"Free" ラベルへ戻す。ユーザーにオフラインである旨を簡潔に表示。
- **完全オフライン初回起動ではpaid扱いにしない**: アプリ内の任意の書き換えを防ぐため、初回起動でサーバー接続できない場合はFreeロックとする。

---

## 6. Free Features

### Excel Converter Example — Free Tier

| Feature | Available? |
|---|---|
| Excel file selection | ✅ Yes |
| HTML preview | ✅ Yes |
| Sheet tab switching | ✅ Yes |
| Basic single-file conversion preview | ✅ Yes |

### Restrictions (Free Tier)

| Feature | Restriction |
|---|---|
| Export HTML | ❌ Restricted — requires Pro |
| Export ZIP | ❌ Restricted — requires Pro |
| Batch conversion | ❌ Not available in Free tier |
| Large file support | ⚠️ Limited file size for Free users |
| Pro feature click behavior | Shows Upgrade dialog when clicked |

---

## 7. Pro Features

### Excel Converter Example — Pro Tier

| Feature | Description |
|---|---|
| Export HTML | Full HTML export of converted content |
| Export ZIP | Batch export as ZIP archive |
| Larger file support | Higher file size limits |
| Batch conversion | Convert multiple files simultaneously |
| Future advanced editor features | In-cell editing, format preservation, etc. |
| Ad-free experience | No upgrade prompts or banner ads |
| Multiple tool unlocks | Access to additional utility tools planned for the hub |

---

## 8. UI Display Rules

| Rule | Description |
|---|---|
| Status label placement | Show "Free" / "Pro active" / "Offline grace" in header area or on each tool screen |
| Pro badge | Mark Pro-only features with a "Pro" badge when the user is on Free tier |
| Free + Pro click → Upgrade dialog | When a Free user taps a Pro feature, show a clear upgrade prompt |
| Error state messaging | Avoid alarming language. Use calm, actionable text like "Unable to verify — will retry." |
| Periodic re-check for paid users | Even when in `paid` state, periodically verify with the server to catch changes (expiry, revocation, etc.) |

---

## 9. Recommended User Flow

### Free Flow
```
Launch → Built-in converter ready → Conversion Preview → Click Pro feature → Upgrade prompt shown
```

### Paid Flow
```
Launch → Auth/Payment status confirmed → "Pro active" label appears → All features available
```

### Offline Grace Flow
```
Launch → Server unreachable → Check local "last confirmed paid" timestamp → Within grace period? → Temporarily unlock Pro → Display "Offline grace" label
→ If grace expired → Fall back to Free tier
```

---

## 10. Implementation Roadmap

### v0.1.4 — Foundation
- [x] Add `AuthPaymentPlan.md` design documentation
- Create UI placeholders for Free/Pro status display areas
- Add "Pro" badge components (non-functional)
- No actual payment or auth integration yet

### v0.2.0 — Sign In
- Add Sign In UI in settings or header menu
- External browser login redirect flow
- Introduce `signed_in_free` state handling
- Still no payment — authentication only

### v0.3.0 — Payment Integration
- Add Checkout redirect flow (external browser)
- Paid confirmation API endpoint integration
- Pro feature unlock based on server response
- Implement `offline_grace` logic with grace period

### v0.4.0+ — Account Management
- Subscription management page
- Full account page with profile, billing info
- License restore functionality
- Billing portal link for self-service management

---

## 11. Security Notes

| Rule | Description |
|---|---|
| No card handling in-app | The app must **never** collect, store, or process credit card information directly. All checkout is via external browser redirect to a trusted payment provider. |
| Do not trust local `paid=true` | Local storage is cache only. Always verify with the server. A compromised local store must never unlock Pro features. |
| No token/secret logging | Authentication tokens, API keys, and payment secrets must **never** be written to logs or console output. |
| No client-embedded secrets | API keys and payment provider secrets must reside on the server side only. The desktop client must not embed any secrets. |
| Server-side plan verification | Plan status (Free vs Pro) is always determined by server-side verification. The client acts on authoritative server responses. |

---

## 12. Open Questions

| Question | Notes |
|---|---|
| One-time purchase or annual subscription? | Pricing model not yet decided |
| Which features qualify as Pro? | Scope of Pro feature set to be refined |
| Where is the Free tier restriction line? | Need clear boundaries for free vs paid capabilities |
| Exact offline grace duration? | 3 days, 7 days, or configurable? |
| Payment provider candidates? | Stripe, Paddle, or another provider? |
| Behavior on account deletion or refund? | How does the app handle revoked access gracefully? |

---

> **Last Updated**: July 2026  
> **Document Type**: Design / Planning only — not implementation
